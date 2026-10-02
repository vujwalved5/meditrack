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

export function toWeeklyPayload(section: string, metrics: any): WeeklyPayloadResult {
  const budget = MAX_SECTION_PAYLOAD_CHARS[section] ?? 2000;
  const trimmed: string[] = [];
  let payload: Record<string, unknown> = {};

  if (section === 'utilization') {
    // Keys: item=name, dept=department, checkouts=checkouts, util_pct=utilization%
    payload = {
      overall: {
        checkouts: metrics.overall.checkouts,
        util_pct: utilPct(metrics.overall.utilization_pct),
        chx_diff: metrics.overall.checkouts_delta_pct,
        util_diff: metrics.overall.utilization_delta_pt,
      },
      daily: metrics.daily.map((d: any) => ({ wd: d.weekday, checkouts: d.checkouts, util_pct: utilPct(d.utilization_pct) })),
      dept: metrics.by_dept.map((d: any) => ({ dept: cleanText(d.department), checkouts: d.checkouts, util_pct: utilPct(d.utilization_pct) })),
      type: metrics.by_type.map((t: any) => ({ item: cleanText(t.type), checkouts: t.checkouts, util_pct: utilPct(t.utilization_pct) })),
      peaks: metrics.peaks.map((p: any) => ({ block: p.block, checkouts: p.checkouts })),
    };
    if (JSON.stringify(payload).length > budget) {
      delete payload.type;
      trimmed.push('dropped type list');
    }
    if (JSON.stringify(payload).length > budget) {
      delete payload.dept;
      trimmed.push('dropped dept list');
    }
  } else if (section === 'demand') {
    // Keys: item=equipment_name, dept=department, requests=count, med_ttd=median_time_to_decision
    const medTtdFmt = fmtH(metrics.requests.median_ttd_hours);
    payload = {
      reqs: {
        submitted: metrics.requests.submitted,
        approved: metrics.requests.approved,
        rejected: metrics.requests.rejected,
        pending: metrics.requests.pending_now,
      },
      urgent_pct: utilPct(metrics.requests.urgent_share_pct),
      approval_pct: utilPct(metrics.requests.approval_rate_pct),
      ...(medTtdFmt !== null ? { med_ttd: medTtdFmt } : {}),
      top_items: metrics.requests.top_requested_items.map((i: any) => ({ item: cleanText(i.name), requests: i.count })),
      by_dept: metrics.requests.demand_by_requester_dept.map((d: any) => ({ dept: cleanText(d.department), requests: d.requests })),
    };
    if (JSON.stringify(payload).length > budget) {
      delete payload.by_dept;
      trimmed.push('dropped by_dept');
    }
  } else if (section === 'health') {
    // Keys: item=equipment_name, dept=department, holder=held_by, hours=hours_since_check, checkouts=checkouts_since_check
    payload = {
      non_usable: metrics.health.non_usable.slice(0, 3).map((u: any) => ({ item: cleanText(u.name), dept: cleanText(u.department), condition: cleanText(u.condition) })),
      cond_changes: metrics.health.condition_changes,
      maint: metrics.health.maintenance_watch.map((m: any, idx: number) => ({ id: `m${idx+1}`, item: cleanText(m.name), hours: fmtH(m.hours_since_check), checkouts: m.checkouts_since_check })),
      long_sess: metrics.health.long_sessions_top.slice(0, 3).map((s: any) => ({ item: cleanText(s.name), duration: fmtH(s.duration_hours) })),
      flagged_open: metrics.health.currently_flagged_open_sessions,
    };
  } else if (section === 'handling') {
    // Keys: holder=user, checkouts=checkouts_count
    payload = {
      users: metrics.handling.distinct_users,
      top_users: metrics.handling.top_users.map((u: any) => ({ holder: cleanText(u.user), checkouts: u.checkouts })),
      off_hrs: metrics.handling.off_hours_checkouts,
      missed: metrics.handling.missed_releases,
      rel_other: metrics.handling.released_by_other_count,
    };
  } else if (section === 'rebalancing') {
    // Keys: item=equipment_name, from=from_department, to=to_department, util_pct=utilization%, requests=demand_requests
    payload = {
      moves: metrics.rebalancing.moves.slice(0,3).map((m: any) => ({
        id: m.candidate_id,
        item: cleanText(m.equipment_name),
        type: cleanText(m.type_display),
        from: cleanText(m.from_department),
        from_util: utilPct(m.evidence.from_utilization),
        to: cleanText(m.to_department),
        to_util: utilPct(m.evidence.to_utilization),
        to_req: m.evidence.to_demand_requests,
      })),
      purchasing: metrics.rebalancing.purchasing.map((p: any) => ({ id: p.id, type: cleanText(p.type), reason: p.reason })),
    };
  } else if (section === 'executive') {
    // Keys: area=section_area, severity=issue_severity, facts=text_facts
    payload = {
      verdict: metrics.verdict,
      overall: {
        checkouts: metrics.overall.checkouts,
        util_pct: utilPct(metrics.overall.utilization_pct),
        chx_diff: metrics.overall.checkouts_delta_pct,
        util_diff: metrics.overall.utilization_delta_pt,
      },
      issues: metrics.issues.map((i: any) => ({ area: i.area, severity: i.severity, facts: i.text_facts })),
      section_summaries: metrics.section_summaries, // passed in explicitly
    };
  }

  return { payloadJson: JSON.stringify(payload), payload, trimmed };
}
