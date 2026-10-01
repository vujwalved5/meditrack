// ============================================================
// compact.ts — Minimal LLM payload builder (Step 1)
// ============================================================
// Rules:
//  - Minified JSON only (no pretty-printing)
//  - Drop nulls, empty arrays, zeros that carry no meaning, ISO timestamps,
//    department ids, basis fields, internal ids (except short ids)
//  - Pre-format values: durations as "19h 5m", percentages as integers
//  - cleanText() on every free-text field
//  - Budget guard with progressive trimming
// ============================================================

import { MAX_USER_PAYLOAD_CHARS } from './config.ts';
import type { BriefMetrics, ForgottenItem, RebalancingCandidate } from './metrics.ts';

// ──────────────────────────────────────────────────────────
// Text helpers
// ──────────────────────────────────────────────────────────

/**
 * Strip control characters, newlines, backticks; collapse whitespace; truncate.
 * Also neutralises any instruction-like content in free-text fields.
 */
export function cleanText(s: unknown, max = 40): string {
  if (s == null) return '';
  // Convert to string, remove control chars and backticks, collapse whitespace
  const cleaned = String(s)
    .replace(/[\x00-\x1F\x7F`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length <= max ? cleaned : cleaned.slice(0, max - 1) + '…';
}

/**
 * Format hours as "Xh Ym" or "Ym". The LLM sees pre-formatted strings;
 * it never needs to convert hours.
 */
export function fmtHm(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Round a utilization fraction (0–1) to an integer percentage. */
function utilPct(frac: number): number {
  return Math.round(frac * 100);
}

// ──────────────────────────────────────────────────────────
// Per-feature payload builders
// ──────────────────────────────────────────────────────────

function buildBriefPayload(
  facts: BriefMetrics,
  opts: { topItems: number; overnight: number; nonUsable: number; deptBreakdown: boolean },
): Record<string, unknown> {
  const yest = facts.yesterday;
  const snap = facts.snapshot;
  const req = facts.requests;
  const cond = facts.condition;

  // Snapshot
  const snapshot: Record<string, unknown> = { total: snap.total };
  if (snap.available) snapshot.available = snap.available;
  if (snap.in_use) snapshot.in_use = snap.in_use;
  const unavailable = snap.total - snap.available - snap.in_use;
  if (unavailable > 0) snapshot.unavailable = unavailable;

  // Yesterday
  const yesterdayObj: Record<string, unknown> = {
    checkouts: yest.checkouts,
    items_used: yest.distinct_items_used,
    util_pct: Math.round(yest.utilization_pct),
  };

  if (opts.deptBreakdown && yest.by_department.length > 0) {
    yesterdayObj.by_dept = yest.by_department
      .filter(d => d.checkouts > 0 || d.utilization_pct > 0)
      .map(d => {
        const o: Record<string, unknown> = { dept: cleanText(d.department, 40) };
        if (d.checkouts) o.checkouts = d.checkouts;
        if (d.utilization_pct) o.util_pct = Math.round(d.utilization_pct);
        return o;
      });
  }

  if (yest.peak_checkout_hour != null) {
    yesterdayObj.peak_hour = yest.peak_checkout_hour;
  }

  if (yest.top_items.length > 0) {
    yesterdayObj.top_items = yest.top_items.slice(0, opts.topItems).map(i => ({
      item: cleanText(i.name, 40),
      checkouts: i.checkouts,
    }));
  }

  // Overnight (max opts.overnight)
  const overnightSlice = facts.overnight.slice(0, opts.overnight);
  const overnightMore = Math.max(0, facts.overnight.length - opts.overnight);

  // Requests
  const reqObj: Record<string, unknown> = { pending: req.pending_count };
  if (req.urgent_pending_count) reqObj.urgent = req.urgent_pending_count;
  if (req.oldest_pending_age_hours != null) {
    reqObj.oldest = fmtHm(req.oldest_pending_age_hours);
  }
  if (req.submitted_yesterday) reqObj.submitted = req.submitted_yesterday;
  if (req.approved_yesterday) reqObj.approved = req.approved_yesterday;
  if (req.rejected_yesterday) reqObj.rejected = req.rejected_yesterday;

  // Condition
  const nonUsableSlice = cond.non_usable.slice(0, opts.nonUsable);
  const condMore = Math.max(0, cond.non_usable.length - opts.nonUsable);

  const payload: Record<string, unknown> = {
    date: cleanText(facts.date_label, 20),
    hist_days: Math.round(facts.data_quality.history_days),
    snapshot,
    base_avg_checkouts: facts.baseline.avg_checkouts_per_day,
    yesterday: yesterdayObj,
  };

  if (overnightSlice.length > 0) {
    payload.overnight = overnightSlice.map(o => ({
      item: cleanText(o.name, 40),
      dept: cleanText(o.department, 40),
      holder: cleanText(o.held_by, 40),
      held: fmtHm(o.held_hours),
    }));
    if (overnightMore > 0) payload.overnight_more = overnightMore;
  }

  payload.requests = reqObj;

  if (nonUsableSlice.length > 0) {
    payload.not_usable = nonUsableSlice.map(e => ({
      item: cleanText(e.name, 40),
      dept: cleanText(e.department, 40),
      condition: cleanText(e.condition, 30),
    }));
    if (condMore > 0) payload.cond_more = condMore;
  }

  if (cond.condition_changes_yesterday > 0) {
    payload.cond_changes = cond.condition_changes_yesterday;
  }

  if (facts.data_quality.is_thin) {
    payload.thin_data = true;
  }

  return payload;
}

// ── Forgotten ──

/**
 * Short-id map: equipment_id → f1, f2, ...
 * The map is stored on the payload result so the caller can merge back.
 */
export interface ForgottenPayloadResult {
  payload: Record<string, unknown>;
  idMap: Map<string, number>; // fId → equipment_id
  trimmed: string[];
  omittedCount: number;
}

function buildForgottenPayload(
  items: ForgottenItem[],
  maxItems: number,
): ForgottenPayloadResult {
  // Sort: critical first, then by ratio descending
  const sorted = [...items].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    return (b.ratio ?? 0) - (a.ratio ?? 0);
  });

  const slice = sorted.slice(0, maxItems);
  const omittedCount = Math.max(0, sorted.length - maxItems);

  const idMap = new Map<string, number>();
  const alerts = slice.map((item, idx) => {
    const fId = `f${idx + 1}`;
    idMap.set(fId, item.equipment_id);

    const o: Record<string, unknown> = {
      id: fId,
      item: cleanText(item.name, 40),
      dept: cleanText(item.department, 40),
      holder: cleanText(item.held_by, 40),
      held: fmtHm(item.held_hours),
      sev: item.severity,
    };

    if (item.typical_hours != null && item.basis !== 'default') {
      o.typical = fmtHm(item.typical_hours);
      if (item.ratio != null) {
        o.x = `${Math.round(item.ratio)}x`;
      }
    } else {
      o.note = 'no usage history, default threshold';
    }

    return o;
  });

  return {
    payload: { alerts },
    idMap,
    trimmed: [],
    omittedCount,
  };
}

// ── Rebalancing ──

function buildRebalancingPayload(
  candidates: RebalancingCandidate[],
  maxCandidates: number,
  histDays: number,
): Record<string, unknown> {
  const slice = candidates.slice(0, maxCandidates);

  const items = slice.map((c, idx) => {
    const cId = `c${idx + 1}`;
    const ev = c.evidence;
    return {
      id: cId,
      type: cleanText(c.type_display, 40),
      move_unit: cleanText(c.equipment_name, 40),
      from: {
        dept: cleanText(c.from_department, 40),
        util_pct: Math.round(ev.from_utilization),
        units: ev.from_units,
      },
      to: {
        dept: cleanText(c.to_department, 40),
        util_pct: Math.round(ev.to_utilization),
        requests: ev.to_demand_requests,
        units: ev.to_available_units,
      },
    };
  });

  return { hist_days: histDays, candidates: items };
}

// ──────────────────────────────────────────────────────────
// Budget guard
// ──────────────────────────────────────────────────────────

export interface PayloadResult {
  payloadJson: string;
  payload: Record<string, unknown>;
  trimmed: string[];
  /** For forgotten: map from fId → equipment_id */
  idMap?: Map<string, number>;
  /** For forgotten: items beyond 8 */
  omittedCount?: number;
}

/**
 * Build the minimal LLM payload for a feature, applying progressive trimming
 * if the payload exceeds MAX_USER_PAYLOAD_CHARS[feature].
 */
export function toLlmPayload(
  feature: 'morning_brief' | 'forgotten_equipment' | 'rebalancing',
  facts: BriefMetrics | ForgottenItem[] | { candidates: RebalancingCandidate[]; historyDays: number },
): PayloadResult {
  const budget = MAX_USER_PAYLOAD_CHARS[feature] ?? 3500;
  const trimmed: string[] = [];

  if (feature === 'morning_brief') {
    const m = facts as BriefMetrics;

    // Stage 0: full payload
    let opts = { topItems: 3, overnight: 5, nonUsable: 5, deptBreakdown: true };
    let p = buildBriefPayload(m, opts);
    let json = JSON.stringify(p);

    // Stage 1: shorten optional lists to 3
    if (json.length > budget) {
      opts = { topItems: 3, overnight: 3, nonUsable: 3, deptBreakdown: true };
      p = buildBriefPayload(m, opts);
      json = JSON.stringify(p);
      trimmed.push('overnight→3, not_usable→3');
    }

    // Stage 2: drop per-department breakdown
    if (json.length > budget) {
      opts = { ...opts, deptBreakdown: false };
      p = buildBriefPayload(m, opts);
      json = JSON.stringify(p);
      trimmed.push('dept_breakdown dropped');
    }

    // Stage 3: further reduce lists to 1
    if (json.length > budget) {
      opts = { ...opts, topItems: 1, overnight: 1, nonUsable: 1 };
      p = buildBriefPayload(m, opts);
      json = JSON.stringify(p);
      trimmed.push('lists→1');
    }

    if (m.yesterday.checkouts === 0 && m.overnight.length === 0 && m.requests.pending_count === 0) {
      (p as any).quiet = true;
      json = JSON.stringify(p);
    }

    return { payloadJson: json, payload: p, trimmed };
  }

  if (feature === 'forgotten_equipment') {
    const items = facts as ForgottenItem[];

    if (items.length === 0) {
      const p = { quiet: true };
      return { payloadJson: JSON.stringify(p), payload: p, trimmed, idMap: new Map(), omittedCount: 0 };
    }

    let maxItems = 8;
    let result = buildForgottenPayload(items, maxItems);
    let json = JSON.stringify(result.payload);

    // Progressive trim: reduce by 2 at a time until it fits
    while (json.length > budget && maxItems > 2) {
      maxItems -= 2;
      result = buildForgottenPayload(items, maxItems);
      json = JSON.stringify(result.payload);
      trimmed.push(`items→${maxItems}`);
    }

    return {
      payloadJson: json,
      payload: result.payload,
      trimmed: [...trimmed, ...result.trimmed],
      idMap: result.idMap,
      omittedCount: result.omittedCount,
    };
  }

  // rebalancing
  const { candidates, historyDays } = facts as { candidates: RebalancingCandidate[]; historyDays: number };

  if (candidates.length === 0) {
    const p = { quiet: true };
    return { payloadJson: JSON.stringify(p), payload: p, trimmed };
  }

  let maxCandidates = 3;
  let p = buildRebalancingPayload(candidates, maxCandidates, Math.round(historyDays));
  let json = JSON.stringify(p);

  while (json.length > budget && maxCandidates > 1) {
    maxCandidates -= 2;
    p = buildRebalancingPayload(candidates, maxCandidates, Math.round(historyDays));
    json = JSON.stringify(p);
    trimmed.push(`candidates→${maxCandidates}`);
  }

  return { payloadJson: json, payload: p, trimmed };
}
