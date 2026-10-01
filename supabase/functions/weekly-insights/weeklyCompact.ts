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

export function toWeeklyPayload(section: string, metrics: any): WeeklyPayloadResult {
  const budget = MAX_SECTION_PAYLOAD_CHARS[section] ?? 2000;
  const trimmed: string[] = [];
  let payload: Record<string, unknown> = {};

  if (section === 'utilization') {
    payload = {
      overall: {
        chx: metrics.overall.checkouts,
        util: utilPct(metrics.overall.utilization_pct),
        chx_diff: metrics.overall.checkouts_delta_pct,
        util_diff: metrics.overall.utilization_delta_pt,
      },
      daily: metrics.daily.map((d: any) => ({ wd: d.weekday, chx: d.checkouts, util: utilPct(d.utilization_pct) })),
      dept: metrics.by_dept.map((d: any) => ({ d: cleanText(d.department), chx: d.checkouts, util: utilPct(d.utilization_pct) })),
      type: metrics.by_type.map((t: any) => ({ t: cleanText(t.type), chx: t.checkouts, util: utilPct(t.utilization_pct) })),
      peaks: metrics.peaks.map((p: any) => ({ t: p.block, chx: p.checkouts })),
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
    payload = {
      reqs: { sub: metrics.requests.submitted, app: metrics.requests.approved, rej: metrics.requests.rejected, pend: metrics.requests.pending_now },
      urgent: utilPct(metrics.requests.urgent_share_pct),
      app_rate: utilPct(metrics.requests.approval_rate_pct),
      med_ttd: metrics.requests.median_ttd_hours,
      top: metrics.requests.top_requested_items.map((i: any) => ({ i: cleanText(i.name), c: i.count })),
      by_dept: metrics.requests.demand_by_requester_dept.map((d: any) => ({ d: cleanText(d.department), c: d.requests })),
    };
    if (JSON.stringify(payload).length > budget) {
      delete payload.by_dept;
      trimmed.push('dropped by_dept');
    }
  } else if (section === 'health') {
    payload = {
      non_usable: metrics.health.non_usable.slice(0, 3).map((u: any) => ({ i: cleanText(u.name), d: cleanText(u.department), c: cleanText(u.condition) })),
      changes: metrics.health.condition_changes,
      maint: metrics.health.maintenance_watch.map((m: any, i: number) => ({ id: `m${i+1}`, i: cleanText(m.name), h: m.hours_since_check, c: m.checkouts_since_check })),
      long_sess: metrics.health.long_sessions_top.slice(0, 3).map((s: any) => ({ i: cleanText(s.name), h: s.duration_hours })),
      flagged_open: metrics.health.currently_flagged_open_sessions,
    };
  } else if (section === 'handling') {
    payload = {
      users: metrics.handling.distinct_users,
      top: metrics.handling.top_users.map((u: any) => ({ u: cleanText(u.user), c: u.checkouts })),
      off_hrs: metrics.handling.off_hours_checkouts,
      missed: metrics.handling.missed_releases,
      rel_other: metrics.handling.released_by_other_count,
    };
  } else if (section === 'rebalancing') {
    payload = {
      moves: metrics.rebalancing.moves.slice(0,3).map((m: any) => ({ id: m.candidate_id, t: cleanText(m.type_display), i: cleanText(m.equipment_name), f: cleanText(m.from_department), f_u: utilPct(m.evidence.from_utilization), t_d: cleanText(m.to_department), t_u: utilPct(m.evidence.to_utilization), t_r: m.evidence.to_demand_requests })),
      purchasing: metrics.rebalancing.purchasing.map((p: any) => ({ id: p.id, t: cleanText(p.type), r: p.reason })),
    };
  } else if (section === 'executive') {
    // Only facts, headline summaries, top issues, verdict
    payload = {
      verdict: metrics.verdict,
      overall: {
        chx: metrics.overall.checkouts, util: utilPct(metrics.overall.utilization_pct),
        chx_diff: metrics.overall.checkouts_delta_pct, util_diff: metrics.overall.utilization_delta_pt
      },
      issues: metrics.issues.map((i: any) => ({ a: i.area, s: i.severity, f: i.text_facts })),
      section_summaries: metrics.section_summaries, // passed in explicitly
    };
  }

  return { payloadJson: JSON.stringify(payload), payload, trimmed };
}
