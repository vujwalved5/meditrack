// ============================================================
// weeklyPrompts.ts — Schemas and prompts for Weekly Analysis
// ============================================================
import { SYSTEM_PROMPT } from '../daily-insights/prompts.ts';

export const WEEKLY_PROMPT_VERSION = 'w4';

export const WEEKLY_EXTRA_RULES = [
  'This is a weekly review for hospital managers.',
  'Compare this week (W) with the previous week (P) only where the data provides both. If no previous data, omit comparisons.',
  'Describe observations and suggestions; never assign blame to individuals.',
  'If evidence is limited (thin_data, small counts), say so and keep conclusions modest.',
  'Mention limited history or limited data ONLY when thin_data is present in the payload.',
  'Reference only the supplied ids (m1, m2, c1 etc). Do NOT invent names or numbers not in the payload.',
  'NEVER use the word "scheduled" — nothing in this system is scheduled. Use "flagged by usage" or "high-usage item".',
  'NEVER generalize a finding for one item to the whole type or fleet (e.g. do not say "all ventilators").',
  'Do NOT use "immediate" or "urgent" unless the issue severity field is "critical".',
  'Hospitals run 24/7. Describe off-hours activity as a count and share (e.g. "12 of 84 checkouts, 14%") without judgment.',
  'Always say "percentage points" for utilization changes (not %).',
  'Item-level idle findings must name the item and its group size, e.g. \'Item \'Wheelchair B\' had 0 checkouts (the other 2 Wheelchair units had 28).\'',
  'The executive actions list [{ref, action, reason}] must reference issue refs from top_issues only. Code will attach owner and priority.',
].join(' ');

export const WEEKLY_SYSTEM_PROMPT = `${SYSTEM_PROMPT}\n${WEEKLY_EXTRA_RULES}`;

/**
 * One-line key legends appended to each section's user prompt so the LLM
 * understands the abbreviated field names in the compact JSON payload.
 */
export const SECTION_KEY_LEGENDS: Record<string, string> = {
  utilization: 'Keys: dept=department, item=equipment_type, checkouts_per_week=checkout_count, util_pct=utilization_percent, wd=weekday(3-char), block=time_block, checkouts_change=formatted_delta, util_change=formatted_pt_delta.',
  demand: 'Keys: item=equipment_name, dept=department, requests_count=number_of_requests, med_ttd=median_hours_to_decision_preformatted, urgent_share_pct=urgent_percent, approval_rate_pct=approved_over_submitted.',
  health: 'Keys: condition_issues=[items_not_fully_usable], usage_review_candidates=[high_usage_items_flagged_by_hours_or_checkouts_NOT_manufacturer_schedules], open_sessions_held_unusually_long=count_of_open_sessions_over_threshold, condition_changes_this_week=count.',
  handling: 'Keys: holder=user_name, checkouts_per_week=checkout_count, off_hours_checkouts=count_outside_06:00-22:00, off_hours_share_pct=percent_of_total, checkouts_without_recorded_release=inferred_sessions, releases_by_non_holder=count.',
  rebalancing: 'Keys: title=code_built_summary, from_dept=from_department, from_util_pct=source_util_percent, to_dept=destination_department, to_util_pct=dest_util_percent, to_demand_requests=pending_requests_at_destination.',
  executive: 'Keys: ref=issue_reference, area=section_area, severity=issue_severity(critical|warning), facts=text_facts, checkouts_per_week=total_checkouts, util_pct=utilization_percent, checkouts_change=formatted_delta, util_change=formatted_pt_delta.',
};

// ──────────────────────────────────────────────────────────
// Schemas
// ──────────────────────────────────────────────────────────

export const STANDARD_SECTION_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: { text: { type: 'string' }, severity: { type: 'string', enum: ['info', 'warning', 'critical'] } },
        required: ['text', 'severity'],
      },
    },
  },
  required: ['summary', 'findings'],
};

export const HEALTH_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: { text: { type: 'string' }, severity: { type: 'string', enum: ['info', 'warning', 'critical'] } },
        required: ['text', 'severity'],
      },
    },
    maintenance: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, message: { type: 'string' }, action: { type: 'string' } },
        required: ['id', 'message', 'action'],
      },
    },
  },
  required: ['summary', 'findings', 'maintenance'],
};

export const REBALANCING_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    moves: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, rationale: { type: 'string' }, caveat: { type: 'string' } },
        required: ['id', 'rationale', 'caveat'],
      },
    },
    purchasing: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, text: { type: 'string' } },
        required: ['id', 'text'],
      },
    },
  },
  required: ['summary', 'moves', 'purchasing'],
};

export const EXECUTIVE_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { 
          ref:    { type: 'string' },
          action: { type: 'string' }, 
          reason: { type: 'string' },
        },
        required: ['ref', 'action', 'reason'],
      },
    },
  },
  required: ['headline', 'summary', 'actions'],
};

export function getWeeklySchema(section: string): any {
  if (section === 'health') return HEALTH_SCHEMA;
  if (section === 'rebalancing') return REBALANCING_SCHEMA;
  if (section === 'executive') return EXECUTIVE_SCHEMA;
  return STANDARD_SECTION_SCHEMA; // utilization, demand, handling
}

// ──────────────────────────────────────────────────────────
// Validators and Coercers
// ──────────────────────────────────────────────────────────

export function validateWeeklySection(section: string, obj: any, expectedIds?: string[]): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (section === 'executive') {
    return typeof obj.headline === 'string' && typeof obj.summary === 'string' &&
      Array.isArray(obj.actions) &&
      obj.actions.every((a: any) => typeof a.ref === 'string' && typeof a.action === 'string' && typeof a.reason === 'string');
  }
  if (typeof obj.summary !== 'string' || !Array.isArray(obj.findings)) return false;
  if (section === 'health' && !Array.isArray(obj.maintenance)) return false;
  if (section === 'rebalancing' && (!Array.isArray(obj.moves) || !Array.isArray(obj.purchasing))) return false;
  
  if (expectedIds) {
    if (section === 'health') {
      const ids = new Set(obj.maintenance.map((m: any) => m.id));
      if (!expectedIds.every(id => ids.has(id))) return false;
    }
    if (section === 'rebalancing') {
      // For rebalancing we expect specific move IDs and purchasing IDs
      // To simplify, we can just check moves IDs if passed as expectedIds
      const ids = new Set(obj.moves.map((m: any) => m.id));
      if (!expectedIds.every(id => ids.has(id))) return false;
    }
  }
  
  return true;
}

export function fallbackFor(section: string, facts: any, errorCategory?: string): any {
  const meta = errorCategory ? { fallback_reason: errorCategory } : {};
  if (section === 'utilization') {
    // Richer deterministic text using actual metric values
    const ov = facts.overall ?? {};
    const hasData = typeof ov.checkouts_per_week === 'number' || typeof ov.checkouts === 'number';
    const checkouts = ov.checkouts_per_week ?? ov.checkouts ?? 0;
    const util = ov.util_pct ?? 0;
    const chxChange = ov.checkouts_change ?? '';
    const utilChange = ov.util_change ?? '';
    // Find busiest and quietest dept
    const depts: any[] = facts.dept ?? [];
    const sorted = [...depts].sort((a, b) => (b.util_pct ?? 0) - (a.util_pct ?? 0));
    const busiest = sorted[0];
    const quietest = sorted.length > 1 ? sorted[sorted.length - 1] : null;
    // Peak slot
    const peaks: any[] = facts.peaks ?? [];
    const topPeak = peaks[0];
    let summary = hasData && typeof ov.util_pct === 'number'
      ? `This week saw ${checkouts} total checkouts and ${util}% overall utilization.`
      : `Insufficient data to compute overall checkouts and utilization.`;
    if (chxChange) summary += ` Checkouts changed by ${chxChange}.`;
    if (utilChange) summary += ` Utilization changed ${utilChange} vs the previous week.`;
    if (busiest) summary += ` Highest utilization: ${busiest.dept} at ${busiest.util_pct ?? 0}% with ${busiest.checkouts ?? 0} checkouts.`;
    if (quietest && quietest.dept !== busiest?.dept) summary += ` Lowest: ${quietest.dept} at ${quietest.util_pct ?? 0}%.`;
    if (topPeak) summary += ` Peak slot: ${topPeak.block} with ${topPeak.checkouts} checkouts.`;
    return { ...meta, summary, findings: [{ text: `Utilization: ${util}% (${utilChange || 'no prior week comparison'}).`, severity: 'info' }] };
  }
  if (section === 'demand') {
    const reqs = facts.requests_summary ?? facts.reqs ?? {};
    return { ...meta,
      summary: `There were ${reqs.submitted ?? 0} requests submitted this week. Approval rate: ${facts.approval_rate_pct ?? 0}%.`,
      findings: [{ text: `Pending now: ${reqs.pending_now ?? 0}.`, severity: 'info' }]
    };
  }
  if (section === 'health') {
    const maintList = facts.usage_review_candidates ?? facts.maint ?? [];
    const condIssues = facts.condition_issues ?? facts.non_usable ?? [];
    return { ...meta,
      summary: `Health review: ${condIssues.length} item(s) with condition issues. ${facts.condition_changes_this_week ?? facts.cond_changes ?? 0} condition change(s) this week.`,
      findings: [{ text: `${maintList.length} item(s) flagged for usage review.`, severity: maintList.length > 0 ? 'warning' : 'info' }],
      maintenance: maintList.map((m: any) => ({
        id: m.id ?? 'm?',
        message: (m.item ?? m.name ?? 'Item') + ' flagged for usage-based review.',
        action: 'Review usage and inspect if needed.',
      }))
    };
  }
  if (section === 'handling') {
    return { ...meta,
      summary: `${facts.distinct_users_this_week ?? facts.users ?? 0} distinct users checked out items this week.`,
      findings: [{ text: `${facts.off_hours_checkouts ?? facts.off_hrs ?? 0} off-hours checkouts (${facts.off_hours_share_pct ?? 0}% of total).`, severity: 'info' }]
    };
  }
  if (section === 'rebalancing') {
    const moves = facts.moves ?? [];
    const purch = facts.purchasing_signals ?? facts.purchasing ?? [];
    return { ...meta,
      summary: moves.length > 0 ? 'Rebalancing opportunities identified.' : 'No rebalancing candidates this week.',
      moves: moves.map((m: any) => ({
        id: m.id ?? 'c?',
        rationale: m.title ?? ('Move ' + (m.item ?? '?') + ' from ' + (m.from_dept ?? m.from ?? '?') + ' to ' + (m.to_dept ?? m.to ?? '?') + '.'),
        caveat: '',
      })),
      purchasing: purch.map((p: any) => ({
        id: p.id ?? 'p?',
        text: (p.reason === 'surplus') 
          ? `Review ${p.type ?? '?'} for surplus.`
          : `Consider adding a unit of ${p.type ?? '?'} (${p.reason ?? ''}).`,
      }))
    };
  }
  if (section === 'executive') {
    const ov = facts.overall ?? {};
    const hasData = typeof ov.checkouts_per_week === 'number' || typeof ov.checkouts === 'number';
    const util = typeof ov.util_pct === 'number' ? ov.util_pct + '%' : 'Insufficient data';
    const checkouts = hasData ? (ov.checkouts_per_week ?? ov.checkouts) : 'Insufficient data';
    
    const actions: any[] = [];
    const issues = facts.issues ?? facts.verdict?.issues ?? [];
    for (let i = 0; i < Math.min(5, issues.length); i++) {
      actions.push({ ref: issues[i].ref, action: issues[i].text_facts ?? issues[i].facts, reason: 'Fallback triggered' });
    }
    
    const verdictLabel = facts.verdict?.verdict === 'good' ? 'On Track' : facts.verdict?.verdict === 'mixed' ? 'Mixed Results' : 'Needs Attention';

    return { ...meta,
      headline: 'Weekly Review: ' + verdictLabel,
      summary: (hasData && typeof ov.util_pct === 'number')
        ? `This week saw ${checkouts} checkouts at ${util} utilization. Review prioritized actions below.`
        : `Insufficient data to compute overall checkouts and utilization. Review prioritized actions below.`,
      actions
    };
  }
  return { ...meta, summary: 'No data available.', findings: [] };
}
