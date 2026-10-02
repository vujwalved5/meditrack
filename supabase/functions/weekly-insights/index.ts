// ============================================================
// index.ts — Weekly Insights Edge Function
// ============================================================
// Auth:   x-cron-secret header (same secret as daily-insights)
// Invoke: auto-fired after INSERT on ai_weekly_reports via AFTER INSERT trigger
//         For synchronous debug: reset status to 'queued', then:
//           curl -X POST .../weekly-insights \
//             -H "x-cron-secret: $CRON_SECRET" \
//             -H "Content-Type: application/json" \
//             -d '{"report_id": N, "wait": true}'
//         Dry run (no DB writes, no LLM calls):
//           curl -X POST .../weekly-insights \
//             -H "x-cron-secret: $CRON_SECRET" \
//             -H "Content-Type: application/json" \
//             -d '{"dry_run": true, "show_prompts": true}'
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { loadAppData } from '../daily-insights/data.ts';
import { computeWeeklyMetrics, attachOwners, processExecutiveActions, stripLimitedDataWording } from './weeklyMetrics.ts';
import { toWeeklyPayload } from './weeklyCompact.ts';
import { getWeeklySchema, WEEKLY_SYSTEM_PROMPT, WEEKLY_PROMPT_VERSION, validateWeeklySection, fallbackFor } from './weeklyPrompts.ts';
import { BudgetCtx, AttemptRecord } from '../daily-insights/llm.ts';
import { getDeepModelConfig, getWeeklyBackupConfig, WEEKLY_TOTAL_BUDGET_MS, WEEKLY_STEP_TIMEOUT_MS, WEEKLY_GAP_MS } from './config.ts';
import { LLM_TIMEOUT_MS } from '../daily-insights/config.ts';
import { callWeeklyLLM, deps, buildIdMap, applySanitization } from './orchestration.ts';

declare var EdgeRuntime: any;

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// use injected sleep
const sleep = deps.sleep;

/** Rate guard: wait until gap ms have passed since the last ai_run_log entry */
async function waitForRunLogGap(db: any, gapMs: number): Promise<void> {
  try {
    const { data } = await db.from('ai_run_log').select('run_at').order('run_at', { ascending: false }).limit(1);
    if (data && data.length > 0) {
      const timeSince = Date.now() - new Date(data[0].run_at).getTime();
      if (timeSince < gapMs) await sleep(gapMs - timeSince);
    }
  } catch {
    // non-fatal; skip the gap if log is inaccessible
  }
}


/**
 * Item 4: Number grounding.
 * Extracts all numbers from AI text and checks each appears in the payload JSON
 * or is in the whitelist of universal constants (7, 14, 24, 168).
 * Returns true if grounded, false if ungrounded numbers found.
 */
const GROUNDING_WHITELIST = new Set([7, 14, 24, 168]);


function isGrounded(text: string, payloadJson: string): boolean {
  // Extract all standalone numbers (integers and decimals) from the text
  const nums = text.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
  for (const raw of nums) {
    const n = parseFloat(raw);
    if (GROUNDING_WHITELIST.has(n)) continue;
    // Check if this number appears anywhere in the payload JSON
    if (!payloadJson.includes(raw)) return false;
  }
  return true;
}

// ──────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  const providedSecret = req.headers.get('x-cron-secret') ?? '';
  if (!cronSecret || providedSecret !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: any = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {}

  const dryRun = body.dry_run === true;
  const reportId = body.report_id ? parseInt(String(body.report_id), 10) : null;

  if (dryRun && !reportId) {
    return handleDryRun(body);
  }

  if (!reportId) {
    return new Response('Missing report_id', { status: 400 });
  }

  const wait = body.wait === true;

  // Always kick off as a promise so the HTTP response can be returned immediately
  const job = (async () => {
    try {
      await runJob(reportId, body);
    } catch (err) {
      console.error(`[weekly] Job ${reportId} uncaught:`, err);
    }
  })();

  if (wait) {
    // Synchronous debug mode — caller blocks until done
    await job;
    return new Response(JSON.stringify({ done: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Normal async path: tell the runtime to keep running after response is sent
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(job);
  }
  return new Response(JSON.stringify({ accepted: true, report_id: reportId }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  });
});

// ──────────────────────────────────────────────────────────
// Dry run — compute payloads, no DB writes, no LLM
// ──────────────────────────────────────────────────────────

async function handleDryRun(body: any) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const db = createClient(supabaseUrl, serviceKey);
  const tz = Deno.env.get('APP_TIMEZONE') ?? 'Asia/Kolkata';
  const now = body.date ? new Date(body.date + 'T00:00:00Z') : new Date();

  const appData = await loadAppData(db, now);
  const metrics = computeWeeklyMetrics(appData, now, tz);

  const sections = ['utilization', 'demand', 'health', 'handling', 'rebalancing', 'executive'];
  const res: any = {};

  // Map section name → the actual metrics sub-key (for full_facts_chars)
  const sectionToMetricsKey: Record<string, string> = {
    utilization: 'utilization', // computed inline below
    demand: 'requests',
    health: 'health',
    handling: 'handling',
    rebalancing: 'rebalancing',
    executive: 'executive', // computed inline below
  };

  for (const s of sections) {
    const pl = toWeeklyPayload(s, {
      ...metrics.metrics,
      verdict: metrics.verdict,
      section_summaries: [],
    });

    // Compute full_facts_chars using the correct sub-key
    let fullFacts: any;
    if (s === 'utilization') {
      fullFacts = {
        overall: metrics.metrics.overall,
        daily: metrics.metrics.daily,
        by_dept: metrics.metrics.by_dept,
        by_type: metrics.metrics.by_type,
        peaks: metrics.metrics.peaks,
      };
    } else if (s === 'executive') {
      fullFacts = {
        verdict: metrics.verdict,
        overall: metrics.metrics.overall,
        issues: metrics.metrics.issues,
        section_summaries: [],
      };
    } else {
      const key = sectionToMetricsKey[s];
      fullFacts = (metrics.metrics as any)[key] ?? {};
    }

    res[s] = {
      full_facts_chars: JSON.stringify(fullFacts).length,
      payload_chars: pl.payloadJson.length,
      est_tokens: Math.round(pl.payloadJson.length / 4),
      trimmed: pl.trimmed,
    };
    if (body.show_prompts) res[s].payload = pl.payload;
  }

  return new Response(JSON.stringify(res, null, 2), { headers: { 'Content-Type': 'application/json' } });
}

// ──────────────────────────────────────────────────────────
// Main job
// ──────────────────────────────────────────────────────────

async function runJob(reportId: number, body: any) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const db = createClient(supabaseUrl, serviceKey);

  // ── Atomic claim: update WHERE status='queued' RETURNING * ──
  // If another worker already claimed it, the result will be empty.
  const { data: claimed, error: claimErr } = await db
    .from('ai_weekly_reports')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', reportId)
    .eq('status', 'queued')
    .select('*');

  if (claimErr || !claimed || claimed.length === 0) {
    console.log(`[weekly] Job ${reportId} already claimed or not found — exiting.`);
    return; // another worker claimed it
  }

  const row = claimed[0];

  // Verify the requesting user is still an active Manager (server-side guard)
  const { data: user, error: uErr } = await db
    .from('users')
    .select('role, is_active')
    .eq('username', row.requested_by)
    .single();

  if (uErr || !user || !user.is_active || user.role !== 'Manager') {
    await db.from('ai_weekly_reports').update({
      status: 'failed',
      error: 'User is not an active Manager.',
      finished_at: new Date().toISOString(),
    }).eq('id', reportId);
    return;
  }

  // ── Final try/catch: always write status on exit ──
  try {
    const tz = Deno.env.get('APP_TIMEZONE') ?? 'Asia/Kolkata';
    const now = body.date ? new Date(body.date + 'T00:00:00Z') : new Date();

    // Load data via paginated loaders in daily-insights/data.ts
    const appData = await loadAppData(db, now);
    const metrics = computeWeeklyMetrics(appData, now, tz);

    // Write week bounds to row
    await db.from('ai_weekly_reports')
      .update({ week_start: metrics.window.start, week_end: metrics.window.end })
      .eq('id', reportId);

    // ── Decide active sections ──
    const allSections = ['utilization', 'demand', 'health', 'handling', 'rebalancing'];
    const activeSections: string[] = [];
    if (metrics.metrics.overall.checkouts > 0) activeSections.push('utilization');
    if (metrics.metrics.requests.submitted > 0 || metrics.metrics.requests.pending_now > 0) activeSections.push('demand');
    activeSections.push('health'); // always present
    if (metrics.metrics.handling.distinct_users > 0) activeSections.push('handling');
    if (metrics.metrics.rebalancing.moves.length > 0 || metrics.metrics.rebalancing.purchasing.length > 0) activeSections.push('rebalancing');
    activeSections.push('executive'); // always last

    // Build compact payloads
    const payloads: Record<string, string> = {};
    const fullPayloads: Record<string, any> = {};
    for (const s of activeSections.filter(s => s !== 'executive')) {
      const pl = toWeeklyPayload(s, metrics.metrics);
      payloads[s] = pl.payloadJson;
      fullPayloads[s] = pl.payload;
    }

    await db.from('ai_weekly_reports')
      .update({ steps_total: activeSections.length })
      .eq('id', reportId);

    // ── Input hash cache ──
    let hashInput = WEEKLY_PROMPT_VERSION;
    for (const s of activeSections.filter(s => s !== 'executive')) hashInput += payloads[s];
    const inputHash = await sha256Hex(hashInput);

    if (!body.force) {
      const { data: cached } = await db.from('ai_weekly_reports')
        .select('id, result, model')
        .eq('status', 'done')
        .eq('input_hash', inputHash)
        .neq('model', 'fallback')
        .gte('finished_at', new Date(Date.now() - 6 * 3600 * 1000).toISOString())
        .order('finished_at', { ascending: false })
        .limit(1);

      if (cached && cached.length > 0) {
        console.log(`[weekly] Cache hit on inputHash for job ${reportId}`);
        await db.from('ai_weekly_reports').update({
          status: 'done',
          model: 'cached',
          result: cached[0].result,
          input_hash: inputHash,
          finished_at: new Date().toISOString(),
        }).eq('id', reportId);
        return;
      }
    }

    // ── LLM configs ──
    const deepPrimary = getDeepModelConfig();
    const budgetCtx: BudgetCtx = { totalBudgetMs: WEEKLY_TOTAL_BUDGET_MS(), usedMs: 0 };
    const gap = WEEKLY_GAP_MS();
    const stepTimeout = WEEKLY_STEP_TIMEOUT_MS();

    const resultJson: any = {
      window: metrics.window,
      verdict: metrics.verdict,
      metrics: metrics.metrics,
      sections: {},
      executive: null,
      meta: {
        attempts: [],
        input_hash: inputHash,
        prompt_version: WEEKLY_PROMPT_VERSION,
        payload_chars: {},
        est_tokens: {},
        trimmed: [],
        budget_exhausted: false,
      },
    };

    let stepDone = 0;
    const modelsUsed = new Set<string>();
    let anyFallback = false;
    let budgetExhausted = false;
    const sectionSummaries: string[] = [];
    const runState = { primaryAuthFailed: false, authFailureLogged: false };
    const fallbacksToRetry: string[] = [];

    // ── Sequential LLM loop ──
    for (let i = 0; i < activeSections.length; i++) {
      const s = activeSections[i];
      await db.from('ai_weekly_reports')
        .update({ current_step: s, steps_done: stepDone })
        .eq('id', reportId);

      // Build section prompt
      let pLoad: string;
      if (s === 'executive') {
        const p = toWeeklyPayload('executive', {
          ...(metrics.metrics as any),
          verdict: metrics.verdict,
          section_summaries: sectionSummaries,
        });
        pLoad = p.payloadJson;
        resultJson.meta.payload_chars[s] = p.payloadJson.length;
        resultJson.meta.est_tokens[s] = Math.round(p.payloadJson.length / 4);
        resultJson.meta.trimmed.push(...p.trimmed);
      } else {
        pLoad = payloads[s];
        resultJson.meta.payload_chars[s] = pLoad.length;
        resultJson.meta.est_tokens[s] = Math.round(pLoad.length / 4);
      }

      const userPrompt = `Section: ${s}\n\nFacts (JSON):\n${pLoad}`;
      const schema = getWeeklySchema(s);

      // ── budget_exhausted check ──
      const rem = budgetCtx.totalBudgetMs - budgetCtx.usedMs;
      if (rem < stepTimeout + gap) {
        budgetExhausted = true;
        resultJson.meta.budget_exhausted = true;
        console.warn(`[weekly] Budget exhausted before section ${s}. Using fallback.`);
        let fd = fallbackFor(s, fullPayloads[s] ?? metrics.metrics, 'budget_exhausted');
        fd = stripLimitedDataWording(fd, metrics.metrics.data_quality.is_thin);
        if (s === 'executive') {
          const rawA = (fd?.actions ?? []) as Array<{ ref: string; action: string; reason: string }>;
          const cleanedActions = processExecutiveActions(rawA, metrics.metrics.issues || []);
          resultJson.executive = { ...fd, actions: cleanedActions, source: 'fallback', verdict: metrics.verdict };
        } else {
          resultJson.sections[s] = { ...fd, source: 'fallback' };
          if (fd.summary) sectionSummaries.push(s + ': ' + fd.summary);
        }
        anyFallback = true;
        stepDone++;
        continue;
      }

      // ── ai_run_log rate guard: wait gap since last run log entry ──
      await waitForRunLogGap(db, gap);

      // ── Call LLM via callWeeklyLLM ──
      const llmResult = await callWeeklyLLM<any>(
        s,
        userPrompt,
        (obj): obj is any => validateWeeklySection(s, obj),
        (obj) => {
          // Coerce: if summary is present, accept as-is
          if (obj && typeof (obj as any).summary === 'string') return obj as any;
          return null;
        },
        () => fallbackFor(s, fullPayloads[s] ?? metrics.metrics),
        db,
        budgetCtx,
        {
          maxOutputTokens: 1200,
          timeoutMs: stepTimeout,
          primary: deepPrimary,
          schema,
          toolName: `write_${s}`,
          logType: `weekly_${s}`,
          systemPrompt: WEEKLY_SYSTEM_PROMPT,
          thinkingBudget: 0,
        },
        runState
      );

      resultJson.meta.attempts.push(...llmResult.attempts);

      let secData = llmResult.data;
      let source = llmResult.usedFallback ? 'fallback' : 'ai';
      const errorCategory = llmResult.attempts.at(-1)?.error_category ?? undefined;
      if (llmResult.usedFallback) {
        anyFallback = true;
        fallbacksToRetry.push(s);
        // Re-run fallbackFor so we get the richer text with fallback_reason attached
        secData = fallbackFor(s, fullPayloads[s] ?? metrics.metrics, errorCategory);
        source = 'fallback';
      } else {
        modelsUsed.add(llmResult.model);
      }

      if (!llmResult.usedFallback) {
        const idMap = buildIdMap(s, fullPayloads[s] ?? metrics.metrics);
        const fallbackData = fallbackFor(s, fullPayloads[s] ?? metrics.metrics, errorCategory);
        secData = applySanitization(secData, fallbackData, idMap);
      }
      
      secData = stripLimitedDataWording(secData, metrics.metrics.data_quality.is_thin);

      // Item 4: number grounding check
      const textToCheck = secData?.summary ?? '';
      const payloadForGround = pLoad;
      if (!llmResult.usedFallback && !isGrounded(textToCheck, payloadForGround)) {
        console.warn(`[weekly] Ungrounded numbers in section ${s}; replacing with deterministic text.`);
        resultJson.meta.ungrounded = resultJson.meta.ungrounded ?? {};
        resultJson.meta.ungrounded[s] = true;
        secData = fallbackFor(s, fullPayloads[s] ?? metrics.metrics, 'ungrounded');
        source = 'fallback';
        anyFallback = true;
      }

      if (s === 'executive') {
        // Item 3: attach owner/priority from code mapping
        const rawActions = (secData?.actions ?? []) as Array<{ ref: string; action: string; reason: string }>;
        const cleanedActions = processExecutiveActions(rawActions, metrics.metrics.issues || []);
        resultJson.executive = { ...secData, actions: cleanedActions, source, verdict: metrics.verdict };
      } else {
        resultJson.sections[s] = { ...secData, source };
        if (secData?.summary) sectionSummaries.push(s + ': ' + secData.summary);
      }

      stepDone++;
      // Persist incremental progress
      await db.from('ai_weekly_reports')
        .update({ steps_done: stepDone, result: resultJson })
        .eq('id', reportId);
    }

    // ── Retry Fallbacks (10s delay if budget remains) ──
    if (fallbacksToRetry.length > 0 && budgetCtx.totalBudgetMs - budgetCtx.usedMs > stepTimeout + 10000) {
      console.log(`[weekly] Budget remains, waiting 10s then retrying ${fallbacksToRetry.length} failed sections sequentially.`);
      await deps.sleep(10000);
      
      for (const s of fallbacksToRetry) {
        if (budgetCtx.totalBudgetMs - budgetCtx.usedMs < stepTimeout) break;
        
        let pLoad = s === 'executive' ? toWeeklyPayload('executive', { ...(metrics.metrics as any), verdict: metrics.verdict, section_summaries: sectionSummaries }).payloadJson : payloads[s];
        const userPrompt = `Section: ${s}\n\nFacts (JSON):\n${pLoad}`;
        const schema = getWeeklySchema(s);

        const llmResult = await callWeeklyLLM<any>(
          s,
          userPrompt,
          (obj): obj is any => validateWeeklySection(s, obj),
          (obj) => {
            if (obj && typeof (obj as any).summary === 'string') return obj as any;
            return null;
          },
          () => fallbackFor(s, fullPayloads[s] ?? metrics.metrics),
          db,
          budgetCtx,
          { maxOutputTokens: 1200, timeoutMs: stepTimeout, primary: deepPrimary, schema, toolName: `write_${s}`, logType: `weekly_retry_${s}`, systemPrompt: WEEKLY_SYSTEM_PROMPT, thinkingBudget: 0 },
          runState
        );
        resultJson.meta.attempts.push(...llmResult.attempts);

        if (!llmResult.usedFallback) {
          let secData = llmResult.data;
          modelsUsed.add(llmResult.model);
          
          const idMap = buildIdMap(s, fullPayloads[s] ?? metrics.metrics);
          const fallbackData = fallbackFor(s, fullPayloads[s] ?? metrics.metrics, llmResult.attempts.at(-1)?.error_category ?? undefined);
          secData = applySanitization(secData, fallbackData, idMap);

          secData = stripLimitedDataWording(secData, metrics.metrics.data_quality.is_thin);

          if (!isGrounded(secData?.summary ?? '', pLoad)) {
             continue; // Grounding failed, keep fallback
          }

          if (s === 'executive') {
            const rawActions = (secData?.actions ?? []) as Array<{ ref: string; action: string; reason: string }>;
            const cleanedActions = processExecutiveActions(rawActions, metrics.metrics.issues || []);
            resultJson.executive = { ...secData, actions: cleanedActions, source: 'ai', verdict: metrics.verdict };
          } else {
            resultJson.sections[s] = { ...secData, source: 'ai' };
          }
          
          // Persist incremental progress for retry
          await db.from('ai_weekly_reports').update({ result: resultJson }).eq('id', reportId);
        }
      }
    }

    // Fill skipped sections with rule-based fallback
    for (const s of allSections) {
      if (!activeSections.includes(s)) {
        let fd = fallbackFor(s, {}, 'no_data');
        fd = stripLimitedDataWording(fd, metrics.metrics.data_quality.is_thin);
        resultJson.sections[s] = { ...fd, source: 'rule' };
      }
    }
    if (!resultJson.executive) {
      let fd = fallbackFor('executive', { ...(metrics.metrics as any), verdict: metrics.verdict }, 'no_data');
      fd = stripLimitedDataWording(fd, metrics.metrics.data_quality.is_thin);
      const rawA = (fd?.actions ?? []) as Array<{ ref: string; action: string; reason: string }>;
      const cleanedActions = processExecutiveActions(rawA, metrics.metrics.issues || []);
      resultJson.executive = { ...fd, actions: cleanedActions, source: 'rule', verdict: metrics.verdict };
      anyFallback = true;
    }

    resultJson.meta.budget_exhausted = budgetExhausted;

    const finalStatus = anyFallback ? 'partial' : 'done';
    const finalModel = modelsUsed.size > 0 ? Array.from(modelsUsed).join(', ') : 'fallback';

    await db.from('ai_weekly_reports').update({
      status: finalStatus,
      model: finalModel,
      result: resultJson,
      input_hash: inputHash,
      finished_at: new Date().toISOString(),
      current_step: null,
    }).eq('id', reportId);

    // ── Retention: keep only the 20 most recent rows ──
    const { data: keep } = await db
      .from('ai_weekly_reports')
      .select('id')
      .order('id', { ascending: false })
      .limit(21);
    if (keep && keep.length === 21) {
      await db.from('ai_weekly_reports').delete().lt('id', keep[20].id);
    }

    console.log(`[weekly] Job ${reportId} completed as ${finalStatus}. Model: ${finalModel}`);

  } catch (e) {
    // ── Final catch: always mark failed ──
    console.error(`[weekly] Fatal error in job ${reportId}:`, e);
    const errStr = 'Internal error: ' + ((e as Error).message ?? String(e));
    await db.from('ai_weekly_reports').update({
      status: 'failed',
      error: errStr,
      finished_at: new Date().toISOString(),
      current_step: null,
    }).eq('id', reportId);

    try {
      await db.from('ai_run_log').insert({
        type: 'weekly_insights',
        outcome: 'failure',
        error_category: 'internal_error',
        error_message: errStr
      });
    } catch (err: any) {
      console.error('[weekly] Failed to insert run log', err);
    }
  }
}
