// ============================================================
// index.ts — Entry point for the daily-insights Edge Function
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { loadAppData } from './data.ts';
import {
  computeBriefMetrics, computeForgottenItems, computeRebalancingCandidates,
} from './metrics.ts';
import { callLLM, BudgetCtx, AttemptRecord } from './llm.ts';
import {
  buildBriefPrompt, validateBriefAI, coerceBriefAI, fallbackBriefAI,
  buildForgottenPrompt, validateForgottenAI, coerceForgottenAI, fallbackForgottenAlert,
  buildRebalancingPrompt, validateRebalancingAI, coerceRebalancingAI, fallbackRebalancingRec,
  fallbackRebalancingAI,
  BriefAI, ForgottenAI, RebalancingAI,
  PROMPT_VERSION,
} from './prompts.ts';
import { toLlmPayload } from './compact.ts';
import { toLocalDate, localDayBounds } from './time.ts';
import { DEFAULT_TIMEZONE, LLM_TOTAL_BUDGET_MS, LLM_GAP_MS } from './config.ts';

const VALID_TYPES = ['morning_brief', 'forgotten_equipment', 'rebalancing'] as const;
type InsightType = typeof VALID_TYPES[number];

// ──────────────────────────────────────────────────────────
// SHA-256 input hash (Web Crypto)
// ──────────────────────────────────────────────────────────
async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ──────────────────────────────────────────────────────────
// Request handler
// ──────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Auth: x-cron-secret header
  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  const providedSecret = req.headers.get('x-cron-secret') ?? '';
  if (!cronSecret || providedSecret !== cronSecret) {
    console.warn('[auth] invalid or missing x-cron-secret header');
    return new Response('Unauthorized', { status: 401 });
  }

  // Parse body
  let body: {
    types?: string[];
    date?: string;
    dry_run?: boolean;
    show_prompts?: boolean;
    force?: boolean;
  } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    // empty or invalid body → use defaults
  }

  const requestedTypes = (body.types ?? VALID_TYPES.slice()).filter(
    (t): t is InsightType => (VALID_TYPES as readonly string[]).includes(t)
  );
  const dryRun = body.dry_run === true;
  const showPrompts = body.show_prompts === true;
  const forceRun = body.force === true;

  const tz = Deno.env.get('APP_TIMEZONE') ?? DEFAULT_TIMEZONE;
  const now = body.date ? new Date(body.date + 'T00:00:00Z') : new Date();
  const todayStr = body.date ?? toLocalDate(now, tz);
  const { end: todayEnd } = localDayBounds(todayStr, tz);
  const effectiveNow = body.date ? new Date(todayEnd.getTime() - 1000) : now;

  console.log(`[daily-insights] types=${requestedTypes.join(',')} date=${todayStr} dry_run=${dryRun} force=${forceRun}`);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const db = createClient(supabaseUrl, serviceKey);

  // ── Load data (parallel, DB work) ──
  let appData: Awaited<ReturnType<typeof loadAppData>>;
  try {
    appData = await loadAppData(db, effectiveNow);
    console.log(`[daily-insights] loaded: ${appData.equipment.length} equipment, ${appData.audit.length} audit rows, ${appData.requests.length} requests`);
  } catch (err) {
    console.error('[daily-insights] data load failed:', (err as Error).message);
    return new Response(JSON.stringify({ error: 'Data load failed', detail: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Compute all facts in parallel ──
  const [briefMetrics, forgottenItems, rebalancingResult] = await Promise.all([
    requestedTypes.includes('morning_brief')
      ? Promise.resolve(computeBriefMetrics(appData, effectiveNow, tz))
      : Promise.resolve(null),
    requestedTypes.includes('forgotten_equipment')
      ? Promise.resolve(computeForgottenItems(appData, effectiveNow))
      : Promise.resolve(null),
    requestedTypes.includes('rebalancing')
      ? Promise.resolve(computeRebalancingCandidates(appData, effectiveNow))
      : Promise.resolve(null),
  ]);

  // ── Dry run (no LLM, no DB writes) ──
  if (dryRun) {
    const output: Record<string, unknown> = {};
    for (const type of requestedTypes) {
      if (type === 'morning_brief' && briefMetrics) {
        const { payloadJson, payload, trimmed } = toLlmPayload('morning_brief', briefMetrics);
        const entry: Record<string, unknown> = {
          status: 'dry_run',
          full_facts_chars: JSON.stringify(briefMetrics).length,
          payload_chars: payloadJson.length,
          est_tokens: Math.round(payloadJson.length / 4),
          trimmed,
        };
        if (showPrompts) entry.payload = payload;
        output[type] = entry;
      } else if (type === 'forgotten_equipment' && forgottenItems !== null) {
        const { payloadJson, payload, trimmed, omittedCount } = toLlmPayload('forgotten_equipment', forgottenItems);
        const entry: Record<string, unknown> = {
          status: 'dry_run',
          full_facts_chars: JSON.stringify(forgottenItems).length,
          payload_chars: payloadJson.length,
          est_tokens: Math.round(payloadJson.length / 4),
          trimmed,
          omitted_count: omittedCount ?? 0,
        };
        if (showPrompts) entry.payload = payload;
        output[type] = entry;
      } else if (type === 'rebalancing' && rebalancingResult) {
        const reb = toLlmPayload('rebalancing', {
          candidates: rebalancingResult.candidates,
          historyDays: appData.historyDays,
        });
        const entry: Record<string, unknown> = {
          status: 'dry_run',
          full_facts_chars: JSON.stringify(rebalancingResult).length,
          payload_chars: reb.payloadJson.length,
          est_tokens: Math.round(reb.payloadJson.length / 4),
          trimmed: reb.trimmed,
          skip_reason: rebalancingResult.skip_reason,
        };
        if (showPrompts) entry.payload = reb.payload;
        output[type] = entry;
      }
    }
    return new Response(JSON.stringify(output, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Shared budget context ──
  const budgetCtx: BudgetCtx = {
    totalBudgetMs: LLM_TOTAL_BUDGET_MS(),
    usedMs: 0,
  };

  // ── Make LLM calls SEQUENTIALLY in spec order ──
  const output: Record<string, unknown> = {};

  for (let i = 0; i < requestedTypes.length; i++) {
    const type = requestedTypes[i];

    // Inter-call gap (except before first)
    if (i > 0) await new Promise<void>(r => setTimeout(r, LLM_GAP_MS()));

    try {
      if (type === 'morning_brief') {
        output[type] = await runBrief(
          briefMetrics!, appData, db, effectiveNow, todayStr, tz, budgetCtx, forceRun,
        );
      } else if (type === 'forgotten_equipment') {
        output[type] = await runForgotten(
          forgottenItems!, appData, db, effectiveNow, todayStr, budgetCtx, forceRun,
        );
      } else {
        output[type] = await runRebalancing(
          rebalancingResult!, appData, db, effectiveNow, todayStr, budgetCtx, forceRun,
        );
      }
    } catch (err) {
      console.error(`[daily-insights] ${type} failed:`, (err as Error).message);
      output[type] = { status: 'error', detail: String(err) };
    }
  }

  return new Response(JSON.stringify(output, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
});

// ──────────────────────────────────────────────────────────
// Feature runners
// ──────────────────────────────────────────────────────────

async function runBrief(
  metrics: ReturnType<typeof computeBriefMetrics>,
  appData: any,
  db: any,
  now: Date,
  todayStr: string,
  tz: string,
  budgetCtx: BudgetCtx,
  forceRun: boolean,
) {
  const { payloadJson, payload, trimmed } = toLlmPayload('morning_brief', metrics);
  const inputHash = await sha256Hex(PROMPT_VERSION + payloadJson);

  // Cache check
  if (!forceRun) {
    const existing = await getExistingRow(db, todayStr, 'morning_brief');
    if (existing && existing.data?.meta?.input_hash === inputHash && existing.model !== 'fallback') {
      console.log(`[daily-insights] morning_brief cached (hash=${inputHash.slice(0, 8)})`);
      return { status: 'cached', model: existing.model };
    }
  }

  const prompt = buildBriefPrompt(metrics.date_label, payloadJson);

  const result = await callLLM<BriefAI>(
    'morning_brief',
    prompt,
    1,
    validateBriefAI,
    (obj) => coerceBriefAI(obj, () => fallbackBriefAI(metrics as any)),
    () => fallbackBriefAI(metrics as any),
    db,
    budgetCtx,
  );

  const title = result.data.headline;
  const summary = result.data.summary;
  const meta = buildMeta(payloadJson, trimmed, result.attempts, inputHash, budgetCtx);
  const dataField = { metrics, ai: result.data, meta };

  await upsertInsight(db, todayStr, 'morning_brief', title, summary, dataField, result.model);
  return buildResponse(result);
}

async function runForgotten(
  items: ReturnType<typeof computeForgottenItems>,
  appData: any,
  db: any,
  now: Date,
  todayStr: string,
  budgetCtx: BudgetCtx,
  forceRun: boolean,
) {
  if (items.length === 0) {
    await upsertInsight(
      db, todayStr, 'forgotten_equipment',
      'Equipment Check',
      'No equipment appears to be held unusually long.',
      { items: [], meta: { payload_chars: 0, est_tokens: 0, attempts: [], input_hash: '' } },
      'none',
    );
    return { status: 'skipped', model: 'none' };
  }

  const { payloadJson, payload, trimmed, idMap, omittedCount } = toLlmPayload('forgotten_equipment', items);
  const inputHash = await sha256Hex(PROMPT_VERSION + payloadJson);

  if (!forceRun) {
    const existing = await getExistingRow(db, todayStr, 'forgotten_equipment');
    if (existing && existing.data?.meta?.input_hash === inputHash && existing.model !== 'fallback') {
      console.log(`[daily-insights] forgotten_equipment cached (hash=${inputHash.slice(0, 8)})`);
      return { status: 'cached', model: existing.model };
    }
  }

  const prompt = buildForgottenPrompt(payloadJson);
  const expectedFIds = Array.from(idMap!.keys());

  // Build lookup: fId → item (for coerce fallback per item)
  const fIdToItem = new Map(
    Array.from(idMap!.entries()).map(([fId, eqId]) => [fId, items.find(i => i.equipment_id === eqId)!])
  );

  function getFallbackForFId(fId: string) {
    const item = fIdToItem.get(fId);
    if (!item) return { message: 'Item held unusually long.', suggested_action: 'Investigate item status.' };
    return fallbackForgottenAlert(item as any);
  }

  const result = await callLLM<ForgottenAI>(
    'forgotten_equipment',
    prompt,
    Math.min(items.length, 8),
    (obj): obj is ForgottenAI => validateForgottenAI(obj, expectedFIds),
    (obj) => coerceForgottenAI(obj, expectedFIds, getFallbackForFId) as unknown as ForgottenAI,
    () => ({
      summary: `${expectedFIds.length} item(s) held unusually long. Review required.`,
      alerts: expectedFIds.map(fId => ({ id: fId, ...getFallbackForFId(fId) })),
    }),
    db,
    budgetCtx,
  );

  // Merge back: fId alerts → equipment_id-based items
  const alertMap = new Map(result.data.alerts.map(a => [a.id, a]));
  const mergedItems = items.map(item => {
    const fId = Array.from(idMap!.entries()).find(([, eqId]) => eqId === item.equipment_id)?.[0];
    const alert = fId ? alertMap.get(fId) : null;
    const fb = fallbackForgottenAlert(item as any);
    return {
      ...item,
      ai_message: alert?.message ?? fb.message,
      suggested_action: alert?.suggested_action ?? fb.suggested_action,
    };
  });

  // Items beyond 8 get deterministic text only (omittedCount tracked in meta)
  const summary = result.data.summary;
  const meta = buildMeta(payloadJson, trimmed, result.attempts, inputHash, budgetCtx, { omitted_count: omittedCount });
  const dataField = { items: mergedItems, meta };

  await upsertInsight(db, todayStr, 'forgotten_equipment', 'Forgotten Equipment Alert', summary, dataField, result.model);
  return buildResponse(result);
}

async function runRebalancing(
  { candidates, skip_reason }: ReturnType<typeof computeRebalancingCandidates>,
  appData: any,
  db: any,
  now: Date,
  todayStr: string,
  budgetCtx: BudgetCtx,
  forceRun: boolean,
) {
  if (skip_reason !== null || candidates.length === 0) {
    const skipMsg = skip_reason ?? 'No rebalancing needed this week.';
    await upsertInsight(
      db, todayStr, 'rebalancing', 'Rebalancing Check', skipMsg,
      { recommendations: [], meta: { payload_chars: 0, est_tokens: 0, attempts: [], input_hash: '' } },
      'none',
    );
    return { status: 'skipped', model: 'none', detail: skipMsg };
  }

  const { payloadJson, payload, trimmed } = toLlmPayload('rebalancing', {
    candidates,
    historyDays: appData.historyDays,
  });
  const inputHash = await sha256Hex(PROMPT_VERSION + payloadJson);

  if (!forceRun) {
    const existing = await getExistingRow(db, todayStr, 'rebalancing');
    if (existing && existing.data?.meta?.input_hash === inputHash && existing.model !== 'fallback') {
      console.log(`[daily-insights] rebalancing cached (hash=${inputHash.slice(0, 8)})`);
      return { status: 'cached', model: existing.model };
    }
  }

  // Only send top 3 to LLM; 4th and 5th get deterministic text
  const llmCandidates = candidates.slice(0, 3);
  const deterministicCandidates = candidates.slice(3);
  const expectedIds = llmCandidates.map(c => c.candidate_id);

  const prompt = buildRebalancingPrompt(payloadJson);

  function getFallbackForId(id: string) {
    const c = llmCandidates.find(x => x.candidate_id === id) ??
      deterministicCandidates.find(x => x.candidate_id === id);
    return c ? fallbackRebalancingRec(c as any) : { rationale: 'Move recommended by utilization analysis.', caveat: '' };
  }

  const result = await callLLM<RebalancingAI>(
    'rebalancing',
    prompt,
    llmCandidates.length,
    (obj): obj is RebalancingAI => validateRebalancingAI(obj, expectedIds),
    (obj) => coerceRebalancingAI(obj, expectedIds, getFallbackForId) as unknown as RebalancingAI,
    () => fallbackRebalancingAI(llmCandidates as any),
    db,
    budgetCtx,
  );

  const recMap = new Map(result.data.recommendations.map(r => [r.candidate_id, r]));

  // Merge all candidates (LLM-text for first 3, deterministic for rest)
  const mergedRecs = candidates.map(c => {
    const rec = recMap.get(c.candidate_id) ?? getFallbackForId(c.candidate_id);
    return { ...c, rationale: rec.rationale, caveat: rec.caveat };
  });

  const summary = result.data.summary;
  const meta = buildMeta(payloadJson, trimmed, result.attempts, inputHash, budgetCtx);
  const dataField = { recommendations: mergedRecs, meta };

  await upsertInsight(db, todayStr, 'rebalancing', 'Department Rebalancing Suggestion', summary, dataField, result.model);
  return buildResponse(result);
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function buildMeta(
  payloadJson: string,
  trimmed: string[],
  attempts: AttemptRecord[],
  inputHash: string,
  budgetCtx: BudgetCtx,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    prompt_version: PROMPT_VERSION,
    payload_chars: payloadJson.length,
    est_tokens: Math.round(payloadJson.length / 4),
    trimmed,
    input_hash: inputHash,
    budget_used_ms: budgetCtx.usedMs,
    attempts: attempts.map(a => ({
      provider: a.provider,
      model: a.model,
      attempt: a.attempt,
      outcome: a.outcome,
      error_category: a.error_category,
      latency_ms: a.latency_ms,
    })),
    ...extra,
  };
}

function buildResponse<T>(result: { model: string; usedFallback: boolean; attempts: AttemptRecord[] }) {
  return {
    status: result.usedFallback ? 'fallback' : 'ok',
    model_used: result.model,
    attempts: result.attempts.length,
    total_latency_ms: result.attempts.reduce((s, a) => s + a.latency_ms, 0),
  };
}

async function getExistingRow(db: any, insightDate: string, type: string): Promise<any | null> {
  const { data, error } = await db
    .from('ai_insights')
    .select('id, model, data')
    .eq('insight_date', insightDate)
    .eq('type', type)
    .order('id', { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;
  return data[0];
}

// ──────────────────────────────────────────────────────────
// Persistence — INSERT first, then DELETE older rows
// This ensures the dashboard always has at least one row
// ──────────────────────────────────────────────────────────
async function upsertInsight(
  db: any,
  insightDate: string,
  type: string,
  title: string,
  summary: string,
  data: Record<string, unknown>,
  model: string,
) {
  // 1. INSERT new row first
  const { data: inserted, error: insErr } = await db.from('ai_insights').insert([{
    insight_date: insightDate,
    type,
    title,
    summary,
    data,
    model,
  }]).select('id');

  if (insErr) {
    throw new Error(`Insert failed for ${type}/${insightDate}: ${insErr.message}`);
  }

  const newId: number = inserted?.[0]?.id;

  // 2. Delete older rows (keep only the just-inserted row)
  if (newId) {
    const { error: delErr } = await db
      .from('ai_insights')
      .delete()
      .eq('insight_date', insightDate)
      .eq('type', type)
      .lt('id', newId);

    if (delErr) {
      console.warn(`[db] cleanup delete failed for ${type}/${insightDate}:`, delErr.message);
    }
  }

  console.log(`[db] upserted ${type} for ${insightDate} (model=${model})`);
}
