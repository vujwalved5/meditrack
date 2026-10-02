// ============================================================
// weeklyCompact.ts — Minimal LLM payload builder for Weekly Analysis
// ============================================================
import { MAX_SECTION_PAYLOAD_CHARS } from './config.ts';
import { cleanText, fmtHm } from '../daily-insights/compact.ts';

export interface WeeklyPayloadResult {
  payloadJson: string;
  payload: Record<string, unknown>;
  trimmed: string[];
}

function utilPct(val: any) {
  return Math.round(Number(val));
}

/** Format a numeric hours value as a human-readable string, e.g. "222h", "1h 5m", "42m". */
function fmtH(val: any): string | null {
  if (val === null || val === undefined) return null;
  return fmtHm(Number(val));
}

/** Format a signed percentage delta: "-14% vs previous week". */
function fmtChxDelta(val: any): string {
  const n = Number(val);
  if (isNaN(n) || val === null || val === undefined) return 'no previous data';
  const sign = n >= 0 ? '+' : '';
  return sign + Math.round(n) + '% vs previous week';
}

/** Format a signed utilization delta in percentage points. */
function fmtUtilDelta(val: any): string {
  const n = Number(val);
  if (isNaN(n) || val === null || val === undefined) return 'no previous data';
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(1) + ' percentage points';
}

export function toWeeklyPayload(section: string, metrics: any): WeeklyPayloadResult {
  const budget = MAX_SECTION_PAYLOAD_CHARS[section] ?? 2000;
  const trimmed: string[] = [];
  let payload: Record<string, unknown> = {};

  if (section === 'utilization') {
    // Legend: dept=department, item=equipment_type, checkouts_per_week=checkout_count,
    //   util_pct=utilization_percent, wd=weekday(3-char), block=time_block,
    //   checkouts_change=formatted_delta, util_change=formatted_pt_delta
    payload = {
      overall: {
        checkouts_per_week: metrics.overall.checkouts,
        util_pct: utilPct(metrics.overall.utilization_pct),
        checkouts_change: fmtChxDelta(metrics.overall.checkouts_delta_pct),
        util_change: fmtUtilDelta(metrics.overall.utilization_delta_pt),
      },
      daily: metrics.daily.map((d: any) => ({ wd: d.weekday, checkouts: d.checkouts, util_pct: utilPct(d.utilization_pct) })),
      dept: metrics.by_dept.map((d: any) => ({ dept: cleanText(d.department), checkouts: d.checkouts, util_pct: utilPct(d.utilization_pct) })),
      type: metrics.by_type.map((t: any) => ({ item: cleanText(t.type), checkouts: t.checkouts, util_pct: utilPct(t.utilization_pct) })),
      peaks: metrics.peaks.map((p: any) => ({ block: p.block, checkouts: p.checkouts })),
    };
    if (JSON.stringify(payload).length > budget) { delete payload.type; trimmed.push('dropped type list'); }
    if (JSON.stringify(payload).length > budget) { delete payload.dept; trimmed.push('dropped dept list'); }

  } else if (section === 'demand') {
    // Legend: item=equipment_name, dept=department, requests_count=number_of_requests,
    //   med_ttd=median_hours_to_decision(pre-formatted), urgent_share_pct=urgent_percent,
    //   approval_rate_pct=approved_over_submitted_percent
    const medTtdFmt = fmtH(metrics.requests.median_ttd_hours);
    payload = {
      requests_summary: {
        submitted: metrics.requests.submitted,
        approved: metrics.requests.approved,
        rejected: metrics.requests.rejected,
        pending_now: metrics.requests.pending_now,
      },
      urgent_share_pct: utilPct(metrics.requests.urgent_share_pct),
      approval_rate_pct: utilPct(metrics.requests.approval_rate_pct),
      ...(medTtdFmt !== null ? { med_ttd: medTtdFmt } : {}),
      top_requested_items: metrics.requests.top_requested_items.map((i: any) => ({ item: cleanText(i.name), requests_count: i.count })),
      demand_by_dept: metrics.requests.demand_by_requester_dept.map((d: any) => ({ dept: cleanText(d.department), requests_count: d.requests })),
    };
    if (JSON.stringify(payload).length > budget) { delete payload.demand_by_dept; trimmed.push('dropped demand_by_dept'); }

  } else if (section === 'health') {
    // Legend:
    //   condition_issues: items not fully available; Needs Maintenance = still usable but flagged;
    //     Out of Order = cannot be used at all.
    //   usage_review_candidates: flagged by usage hours/checkouts only — NOT manufacturer schedules.
    //   open_sessions_held_unusually_long: count of currently open sessions exceeding typical duration.
    payload = {
      condition_issues: metrics.health.non_usable.slice(0, 3).map((u: any) => ({
        item: cleanText(u.name), dept: cleanText(u.department), condition: cleanText(u.condition),
      })),
      condition_changes_this_week: metrics.health.condition_changes,
      usage_review_candidates: metrics.health.maintenance_watch.map((m: any, idx: number) => ({
        id: 'm' + (idx + 1), item: cleanText(m.name),
        hours_since_last_check: fmtH(m.hours_since_check),
        checkouts_since_last_check: m.checkouts_since_check,
      })),
      long_sessions: metrics.health.long_sessions_top.slice(0, 3).map((s: any) => ({
        item: cleanText(s.name), session_duration: fmtH(s.duration_hours),
      })),
      open_sessions_held_unusually_long: metrics.health.currently_flagged_open_sessions,
    };

  } else if (section === 'handling') {
    // Legend: holder=user_name, checkouts_per_week=checkout_count,
    //   checkouts_without_recorded_release=inferred_sessions (user forgot to release),
    //   releases_by_non_holder=released_by_different_user,
    //   off_hours_checkouts=checkouts_outside_06:00-22:00, off_hours_share_pct=percent_of_total.
    //   Hospitals run 24/7 — off-hours count and share are reported without judgment.
    payload = {
      distinct_users_this_week: metrics.handling.distinct_users,
      top_holders: metrics.handling.top_users.map((u: any) => ({
        holder: cleanText(u.user), checkouts_per_week: u.checkouts,
      })),
      off_hours_checkouts: metrics.handling.off_hours_checkouts,
      off_hours_share_pct: utilPct(metrics.handling.off_hours_share_pct),
      checkouts_without_recorded_release: metrics.handling.missed_releases,
      releases_by_non_holder: metrics.handling.released_by_other_count,
    };

  } else if (section === 'rebalancing') {
    // Legend: from_dept=source_department, from_util_pct=source_util,
    //   to_dept=destination_department, to_util_pct=dest_util, to_demand_requests=pending_requests_at_dest.
    // title is a code-built human summary shown even when the section is collapsed.
    payload = {
      moves: metrics.rebalancing.moves.slice(0, 3).map((m: any) => ({
        id: m.candidate_id,
        title: 'Move ' + cleanText(m.equipment_name) + ': ' + cleanText(m.from_department) +
               ' (' + utilPct(m.evidence.from_utilization) + '% util) to ' +
               cleanText(m.to_department) + ' (' + utilPct(m.evidence.to_utilization) + '% util, ' +
               m.evidence.to_demand_requests + ' requests)',
        item: cleanText(m.equipment_name),
        type: cleanText(m.type_display),
        from_dept: cleanText(m.from_department),
        from_util_pct: utilPct(m.evidence.from_utilization),
        to_dept: cleanText(m.to_department),
        to_util_pct: utilPct(m.evidence.to_utilization),
        to_demand_requests: m.evidence.to_demand_requests,
      })),
      purchasing_signals: metrics.rebalancing.purchasing.map((p: any) => ({
        id: p.id, type: cleanText(p.type), reason: p.reason,
      })),
    };

  } else if (section === 'executive') {
    // Legend: area=section_area, severity=issue_severity, facts=text_facts
    payload = {
      verdict: metrics.verdict,
      overall: {
        checkouts_per_week: metrics.overall.checkouts,
        util_pct: utilPct(metrics.overall.utilization_pct),
        checkouts_change: fmtChxDelta(metrics.overall.checkouts_delta_pct),
        util_change: fmtUtilDelta(metrics.overall.utilization_delta_pt),
      },
      top_issues: (metrics.issues || []).map((i: any) => ({ area: i.area, severity: i.severity, facts: i.text_facts })),
      section_summaries: metrics.section_summaries ?? [],
    };
  }

  return { payloadJson: JSON.stringify(payload), payload, trimmed };
}
