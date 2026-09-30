// ============================================================
// index.ts — Entry point for the daily-insights Edge Function
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { loadAppData } from './data.ts';
import { computeBriefMetrics, computeForgottenItems, computeRebalancingCandidates } from './metrics.ts';
import { callLLM } from './llm.ts';
import {
  buildBriefPrompt, validateBriefAI, fallbackBriefAI,
  buildForgottenPrompt, validateForgottenAI, fallbackForgottenAI, fallbackForgottenAlert,
  buildRebalancingPrompt, validateRebalancingAI, fallbackRebalancingAI,
  ForgottenAI, RebalancingAI,
} from './prompts.ts';
import { toLocalDate, localDayBounds } from './time.ts';
import { DEFAULT_TIMEZONE } from './config.ts';

const VALID_TYPES = ['morning_brief', 'forgotten_equipment', 'rebalancing'] as const;
type InsightType = typeof VALID_TYPES[number];

// ──────────────────────────────────────────────────────────
// Request handler
// ──────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Method gate
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
  let body: { types?: string[]; date?: string; dry_run?: boolean } = {};
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

  // Determine "today" in the hospital timezone
  const tz = Deno.env.get('APP_TIMEZONE') ?? DEFAULT_TIMEZONE;
  const now = body.date ? new Date(body.date + 'T00:00:00Z') : new Date();
  // For a date override, use the end of that local day as "now"
  const todayStr = body.date ?? toLocalDate(now, tz);
  const { end: todayEnd } = localDayBounds(todayStr, tz);
  const effectiveNow = body.date ? new Date(todayEnd.getTime() - 1000) : now;

  console.log(`[daily-insights] types=${requestedTypes.join(',')} date=${todayStr} dry_run=${dryRun}`);

  // Supabase client with service-role key (bypasses RLS)
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const db = createClient(supabaseUrl, serviceKey);

  // Load all data
  let appData;
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

  // Run features independently
  const results = await Promise.allSettled(
    requestedTypes.map(type => runFeature(type, appData, db, effectiveNow, todayStr, tz, dryRun))
  );

  const output: Record<string, unknown> = {};
  requestedTypes.forEach((type, i) => {
    const r = results[i];
    if (r.status === 'fulfilled') {
      output[type] = r.value;
    } else {
      console.error(`[daily-insights] ${type} failed:`, r.reason);
      output[type] = { status: 'error', detail: String(r.reason) };
    }
  });

  return new Response(JSON.stringify(output, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
});

// ──────────────────────────────────────────────────────────
// Feature runners
// ──────────────────────────────────────────────────────────

async function runFeature(
  type: InsightType,
  appData: ReturnType<typeof loadAppData> extends Promise<infer T> ? T : never,
  db: ReturnType<typeof createClient>,
  now: Date,
  todayStr: string,
  tz: string,
  dryRun: boolean,
): Promise<{ status: string; model?: string; detail?: unknown }> {

  if (type === 'morning_brief') {
    return runBrief(appData, db, now, todayStr, tz, dryRun);
  } else if (type === 'forgotten_equipment') {
    return runForgotten(appData, db, now, todayStr, dryRun);
  } else {
    return runRebalancing(appData, db, now, todayStr, dryRun);
  }
}

// ── Morning Brief ──
async function runBrief(appData: any, db: any, now: Date, todayStr: string, tz: string, dryRun: boolean) {
  const metrics = computeBriefMetrics(appData, now, tz);

  if (dryRun) {
    return { status: 'dry_run', detail: { metrics } };
  }

  const metricsJson = JSON.stringify(metrics);
  const prompt = buildBriefPrompt(metrics.date_label, metricsJson);

  const result = await callLLM(
    prompt,
    validateBriefAI,
    () => fallbackBriefAI(metrics as any),
  );

  const title = result.data.headline;
  const summary = result.data.summary;
  const dataField = { metrics, ai: result.data };

  await upsertInsight(db, todayStr, 'morning_brief', title, summary, dataField, result.model);
  return { status: result.usedFallback ? 'fallback' : 'ok', model: result.model };
}

// ── Forgotten Equipment ──
async function runForgotten(appData: any, db: any, now: Date, todayStr: string, dryRun: boolean) {
  const items = computeForgottenItems(appData, now);

  if (dryRun) {
    return { status: 'dry_run', detail: { items } };
  }

  if (items.length === 0) {
    await upsertInsight(
      db, todayStr, 'forgotten_equipment',
      'Equipment Check',
      'No equipment appears to be held unusually long.',
      { items: [] },
      'none',
    );
    return { status: 'skipped', model: 'none' };
  }

  const itemsJson = JSON.stringify(items);
  const prompt = buildForgottenPrompt(itemsJson);
  const expectedIds = items.map(i => i.equipment_id);

  const result = await callLLM<ForgottenAI>(
    prompt,
    (obj) => validateForgottenAI(obj, expectedIds),
    () => fallbackForgottenAI(items),
  );

  // Merge ai_message and suggested_action per equipment_id; fill any missing from fallback
  const alertMap = new Map(result.data.alerts.map(a => [a.equipment_id, a]));
  const mergedItems = items.map(item => {
    const alert = alertMap.get(item.equipment_id) ?? fallbackForgottenAlert(item);
    return { ...item, ai_message: alert.message, suggested_action: alert.suggested_action };
  });

  const summary = result.data.summary;
  const dataField = { items: mergedItems };

  await upsertInsight(db, todayStr, 'forgotten_equipment', 'Forgotten Equipment Alert', summary, dataField, result.model);
  return { status: result.usedFallback ? 'fallback' : 'ok', model: result.model };
}

// ── Rebalancing ──
async function runRebalancing(appData: any, db: any, now: Date, todayStr: string, dryRun: boolean) {
  const { candidates, skip_reason } = computeRebalancingCandidates(appData, now);

  if (dryRun) {
    return { status: 'dry_run', detail: { candidates, skip_reason } };
  }

  if (skip_reason !== null || candidates.length === 0) {
    const skipMsg = skip_reason ?? 'No rebalancing needed this week.';
    await upsertInsight(db, todayStr, 'rebalancing', 'Rebalancing Check', skipMsg, { recommendations: [] }, 'none');
    return { status: 'skipped', model: 'none', detail: skipMsg };
  }

  const candidatesJson = JSON.stringify(candidates);
  const prompt = buildRebalancingPrompt(candidatesJson);
  const expectedIds = candidates.map(c => c.candidate_id);

  const result = await callLLM<RebalancingAI>(
    prompt,
    (obj) => validateRebalancingAI(obj, expectedIds),
    () => fallbackRebalancingAI(candidates),
  );

  // Merge rationale and caveat from AI into candidate objects
  const recMap = new Map(result.data.recommendations.map(r => [r.candidate_id, r]));
  const mergedRecs = candidates.map(c => {
    const rec = recMap.get(c.candidate_id) ?? fallbackRebalancingAI([c]).recommendations[0];
    return { ...c, rationale: rec.rationale, caveat: rec.caveat };
  });

  const summary = result.data.summary;
  const dataField = { recommendations: mergedRecs };

  await upsertInsight(db, todayStr, 'rebalancing', 'Department Rebalancing Suggestion', summary, dataField, result.model);
  return { status: result.usedFallback ? 'fallback' : 'ok', model: result.model };
}

// ──────────────────────────────────────────────────────────
// Persistence (idempotent: delete + insert)
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
  // Delete existing row for same type+date (makes re-runs idempotent)
  const { error: delErr } = await db
    .from('ai_insights')
    .delete()
    .eq('insight_date', insightDate)
    .eq('type', type);

  if (delErr) {
    console.error(`[db] delete failed for ${type}/${insightDate}:`, delErr.message);
  }

  const { error: insErr } = await db.from('ai_insights').insert([{
    insight_date: insightDate,
    type,
    title,
    summary,
    data,
    model,
  }]);

  if (insErr) {
    throw new Error(`Insert failed for ${type}/${insightDate}: ${insErr.message}`);
  }

  console.log(`[db] upserted ${type} for ${insightDate} (model=${model})`);
}
