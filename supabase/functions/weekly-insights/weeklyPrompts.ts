// ============================================================
// weeklyPrompts.ts — Schemas and prompts for Weekly Analysis
// ============================================================
import { SYSTEM_PROMPT } from '../daily-insights/prompts.ts';

export const WEEKLY_PROMPT_VERSION = 'w2';

export const WEEKLY_EXTRA_RULES = 
  `This is a weekly review for hospital managers. Compare this week (W) with the previous week (P) only where the data provides both. Describe observations and suggestions; never assign blame to individuals. If evidence is limited (thin_data, small counts), say so and keep conclusions modest. Reference only the supplied ids.`;

export const WEEKLY_SYSTEM_PROMPT = `${SYSTEM_PROMPT}\n${WEEKLY_EXTRA_RULES}`;

/**
 * One-line key legends appended to each section's user prompt so the LLM
 * understands the abbreviated field names in the compact JSON payload.
 */
export const SECTION_KEY_LEGENDS: Record<string, string> = {
  utilization: 'Key: dept=department, item=equipment_type, checkouts=checkout_count, util_pct=utilization_percent, wd=weekday, block=time_block.',
  demand: 'Key: item=equipment_name, dept=department, requests=request_count, med_ttd=median_hours_to_decision, urgent_pct=urgent_percent, approval_pct=approval_rate_percent.',
  health: 'Key: item=equipment_name, dept=department, hours=hours_since_last_check, checkouts=checkouts_since_last_check, duration=session_duration, flagged_open=open_sessions_over_threshold.',
  handling: 'Key: holder=user_name, checkouts=checkout_count, off_hrs=off_hours_checkouts, missed=missed_releases, rel_other=released_by_different_user.',
  rebalancing: 'Key: item=equipment_name, type=equipment_type, from=from_department, from_util=from_util_pct, to=to_department, to_util=to_util_pct, to_req=to_demand_requests.',
  executive: 'Key: area=section_area, severity=issue_severity, facts=text_facts, util_pct=utilization_percent, chx_diff=checkout_delta_pct, util_diff=utilization_delta_pt.',
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
          action: { type: 'string' }, 
          reason: { type: 'string' }, 
          priority: { type: 'integer' }, 
          owner: { type: 'string', enum: ['Manager', 'Senior Doctor', 'Staff'] } 
        },
        required: ['action', 'reason', 'priority', 'owner'],
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
    return typeof obj.headline === 'string' && typeof obj.summary === 'string' && Array.isArray(obj.actions);
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

export function fallbackFor(section: string, facts: any): any {
  if (section === 'utilization') {
    return {
      summary: `Utilization was ${facts.overall?.util_pct ?? 0}% this week with ${facts.overall?.checkouts ?? 0} checkouts.`,
      findings: [{ text: `Checkouts changed by ${facts.overall?.chx_diff ?? 0}%.`, severity: 'info' }]
    };
  }
  if (section === 'demand') {
    return {
      summary: `There were ${facts.reqs?.submitted ?? 0} requests submitted this week.`,
      findings: [{ text: `Approval rate was ${facts.approval_pct ?? 0}%.`, severity: 'info' }]
    };
  }
  if (section === 'health') {
    const maintList = facts.maint || [];
    return {
      summary: `Health review completed.`,
      findings: [{ text: `${facts.cond_changes ?? 0} condition changes recorded.`, severity: 'info' }],
      maintenance: maintList.map((m: any) => ({
        id: m.id,
        message: `${m.item} requires maintenance check.`,
        action: `Review and schedule maintenance.`
      }))
    };
  }
  if (section === 'handling') {
    return {
      summary: `${facts.users ?? 0} distinct users checked out items.`,
      findings: [{ text: `${facts.off_hrs ?? 0} off-hours checkouts occurred.`, severity: 'info' }]
    };
  }
  if (section === 'rebalancing') {
    const moves = facts.moves || [];
    const purch = facts.purchasing || [];
    return {
      summary: `Rebalancing candidates identified.`,
      moves: moves.map((m: any) => ({
        id: m.id,
        rationale: `Move ${m.item} from ${m.from} to ${m.to}.`,
        caveat: ``
      })),
      purchasing: purch.map((p: any) => ({
        id: p.id,
        text: `Consider purchasing ${p.type}.`
      }))
    };
  }
  if (section === 'executive') {
    return {
      headline: `Weekly Review: ${facts.verdict === 'good' ? 'On Track' : 'Needs Attention'}`,
      summary: `Utilization: ${facts.overall?.util_pct ?? 0}%. Please review issues.`,
      actions: [{ action: `Review flagged issues.`, reason: `Ensure smooth operations.`, priority: 1, owner: 'Manager' }]
    };
  }
  return { summary: 'No data.', findings: [] };
}
