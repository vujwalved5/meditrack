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
import { computeWeeklyMetrics } from './weeklyMetrics.ts';
import { toWeeklyPayload } from './weeklyCompact.ts';
import { getWeeklySchema, WEEKLY_SYSTEM_PROMPT, WEEKLY_PROMPT_VERSION, validateWeeklySection, fallbackFor } from './weeklyPrompts.ts';
import { callLLM, BudgetCtx, AttemptRecord } from '../daily-insights/llm.ts';
import { getDeepModelConfig, getWeeklyBackupConfig, WEEKLY_TOTAL_BUDGET_MS, WEEKLY_STEP_TIMEOUT_MS } from './config.ts';
import { LLM_GAP_MS, LLM_TIMEOUT_MS } from '../daily-insights/config.ts';

declare var EdgeRuntime: any;

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

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

  for (const s of sections) {
    const pl = toWeeklyPayload(s, metrics.metrics);
    res[s] = {
      full_facts_chars: JSON.stringify((metrics.metrics as any)[s] ?? {}).length,
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
    const deepBackup = getWeeklyBackupConfig();
    const budgetCtx: BudgetCtx = { totalBudgetMs: WEEKLY_TOTAL_BUDGET_MS(), usedMs: 0 };
    const gap = LLM_GAP_MS();
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
        const fd = fallbackFor(s, fullPayloads[s] ?? metrics.metrics);
        if (s === 'executive') {
          resultJson.executive = { ...fd, source: 'fallback' };
        } else {
          resultJson.sections[s] = { ...fd, source: 'fallback' };
          if (fd.summary) sectionSummaries.push(`${s}: ${fd.summary}`);
        }
        anyFallback = true;
        stepDone++;
        continue;
      }

      // ── ai_run_log rate guard: wait gap since last run log entry ──
      await waitForRunLogGap(db, gap);

      // ── Call LLM via callLLM (reusing daily retry chain) ──
      const llmResult = await callLLM<any>(
        s,
        userPrompt,
        0, // itemCount — not used for weekly; tokenBudget fallback applies
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
          modelOverride: { primary: deepPrimary, backup: deepBackup },
          schema,
          toolName: `write_${s}`,
          logType: `weekly_${s}`,
          systemPrompt: WEEKLY_SYSTEM_PROMPT,
          thinkingBudget: 0,
        },
      );

      resultJson.meta.attempts.push(...llmResult.attempts);

      let secData = llmResult.data;
      let source = llmResult.usedFallback ? 'fallback' : 'ai';
      if (llmResult.usedFallback) anyFallback = true;
      else modelsUsed.add(llmResult.model);

      if (s === 'executive') {
        resultJson.executive = { ...secData, source };
      } else {
        resultJson.sections[s] = { ...secData, source };
        if (secData?.summary) sectionSummaries.push(`${s}: ${secData.summary}`);
      }

      stepDone++;
      // Persist incremental progress
      await db.from('ai_weekly_reports')
        .update({ steps_done: stepDone, result: resultJson })
        .eq('id', reportId);
    }

    // Fill skipped sections with rule-based fallback
    for (const s of allSections) {
      if (!activeSections.includes(s)) {
        resultJson.sections[s] = { ...fallbackFor(s, {}), source: 'rule' };
      }
    }
    if (!resultJson.executive) {
      resultJson.executive = { ...fallbackFor('executive', metrics.metrics), source: 'rule' };
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
    await db.from('ai_weekly_reports').update({
      status: 'failed',
      error: 'Internal error: ' + ((e as Error).message ?? String(e)),
      finished_at: new Date().toISOString(),
      current_step: null,
    }).eq('id', reportId);
  }
}
