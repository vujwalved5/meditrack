// ============================================================
// types.ts — Canonical result shape for weekly-insights
// This file is the single source of truth for what is stored
// in ai_weekly_reports.result and what index.html reads.
// ============================================================

/**
 * UI_READS lists every dot-notation path the renderer in index.html
 * reads from result.metrics. Used by the contract test.
 */
export const UI_READS: Array<{ path: string; type: 'number' | 'string' | 'array' | 'object' }> = [
  // Stat cards
  { path: 'metrics.overall.checkouts',           type: 'number' },
  { path: 'metrics.overall.utilization_pct',     type: 'number' },
  { path: 'metrics.overall.utilization_delta_pt',type: 'number' },
  { path: 'metrics.overall.checkouts_delta_pct', type: 'number' },
  // Charts
  { path: 'metrics.daily',                       type: 'array'  },
  { path: 'metrics.by_dept',                     type: 'array'  },
  // Executive
  { path: 'executive.headline',                  type: 'string' },
  { path: 'executive.summary',                   type: 'string' },
  { path: 'executive.actions',                   type: 'array'  },
  { path: 'executive.verdict',                   type: 'string' },
  // Sections list
  { path: 'sections',                            type: 'object' },
  // Verdict
  { path: 'verdict',                             type: 'string' },
];

/** Shape of daily[] entries — must match what computeWeeklyMetrics returns */
export interface DailyEntry {
  date: string;
  weekday: string;
  checkouts: number;
  utilization_pct: number;
}

/** Shape of by_dept[] entries */
export interface DeptEntry {
  department: string;
  units: number;
  checkouts: number;
  utilization_pct: number;
  utilization_delta_pt: number;
}

/** The overall utilization summary */
export interface OverallMetrics {
  checkouts: number;
  distinct_items_used: number;
  total_busy_hours: number;
  utilization_pct: number;
  prev_checkouts: number;
  prev_utilization_pct: number;
  checkouts_delta_pct: number;
  utilization_delta_pt: number;
}

/** An issue surfaced to the executive summary */
export interface WeeklyIssue {
  ref: string;
  area: string;
  severity: 'critical' | 'warning' | 'info';
  text_facts: string;
}

/** An executive action with owner assigned by code */
export interface ExecAction {
  ref: string;
  action: string;
  reason: string;
  priority: number;
  owner: 'Manager' | 'Senior Doctor' | 'Staff';
}

/**
 * The full shape stored in ai_weekly_reports.result.
 * The renderer reads directly from this shape — never from the compact LLM payload.
 */
export interface WeeklyResult {
  window: { start: string; end: string; prev_start: string; tz: string };
  verdict: 'good' | 'mixed' | 'needs_attention';
  metrics: {
    overall: OverallMetrics;
    daily: DailyEntry[];
    by_dept: DeptEntry[];
    by_type: any[];
    items: any;
    peaks: any[];
    requests: any;
    health: any;
    handling: any;
    rebalancing: any;
    data_quality: any;
    issues: WeeklyIssue[];
  };
  sections: Record<string, {
    summary: string;
    findings?: Array<{ text: string; severity: string }>;
    maintenance?: any[];
    moves?: any[];
    purchasing?: any[];
    source: 'ai' | 'fallback' | 'rule';
    fallback_reason?: string;
  }>;
  executive: {
    headline: string;
    summary: string;
    actions: ExecAction[];
    verdict?: string;
    source: 'ai' | 'fallback' | 'rule';
  };
  meta: {
    attempts: any[];
    input_hash: string;
    prompt_version: string;
    payload_chars: Record<string, number>;
    est_tokens: Record<string, number>;
    trimmed: string[];
    budget_exhausted: boolean;
    ungrounded?: Record<string, boolean>;
  };
}
