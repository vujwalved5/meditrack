// ============================================================
// config.ts — All threshold constants for daily-insights
// ============================================================

// ──────────────────────────────────────────────────────────
// DOMAIN / METRICS THRESHOLDS (unchanged)
// ──────────────────────────────────────────────────────────

/** Minimum sessions required to compute a type-level median */
export const MIN_SESSIONS_FOR_TYPE_MEDIAN = 5;

/** Minimum sessions required to compute a global median */
export const MIN_SESSIONS_FOR_GLOBAL_MEDIAN = 5;

/** Flat default threshold (hours) when no median is available */
export const DEFAULT_THRESHOLD_HOURS = 8;

/** Threshold multiplier: flag if held >= N × median */
export const THRESHOLD_MEDIAN_MULTIPLIER = 3;

/** Minimum threshold (hours) even when N × median is small */
export const THRESHOLD_MIN_HOURS = 2;

/** Critical severity if held >= N × median (or >= 24h when no median) */
export const CRITICAL_MEDIAN_MULTIPLIER = 6;

/** Critical threshold (hours) when no median (or basis is 'default') */
export const CRITICAL_HOURS_NO_MEDIAN = 24;

/** Rebalancing: pressure dept – min demand requests */
export const PRESSURE_MIN_DEMAND_REQUESTS = 3;

/** Rebalancing: pressure dept – utilization gate (combined check) */
export const PRESSURE_UTILIZATION_GATE = 0.70;

/** Rebalancing: pressure dept – combined check min demand requests */
export const PRESSURE_COMBINED_MIN_DEMAND = 1;

/** Rebalancing: surplus dept – max utilization */
export const SURPLUS_MAX_UTILIZATION = 0.25;

/** Rebalancing: surplus dept – must have zero demand requests */
export const SURPLUS_MAX_DEMAND_REQUESTS = 0;

/** Rebalancing: surplus dept – min available usable units */
export const SURPLUS_MIN_AVAILABLE_UNITS = 1;

/** Rebalancing: surplus dept – min total units (unless util is very low) */
export const SURPLUS_MIN_TOTAL_UNITS = 2;

/** Rebalancing: surplus dept – very low utilization override for single-unit depts */
export const SURPLUS_VERY_LOW_UTILIZATION = 0.10;

/** Rebalancing: window in hours */
export const REBALANCING_WINDOW_HOURS = 7 * 24;

/** Rebalancing: max candidates to compute (top 5 scored; only top 3 go to LLM) */
export const MAX_REBALANCING_CANDIDATES = 5;

/** Minimum history days before rebalancing is attempted */
export const MIN_HISTORY_DAYS = 3;

/** Minimum session duration (minutes) to count in statistics (exclude accidental toggles) */
export const MIN_SESSION_MINUTES = 1;

/** How many days of audit log to load for session building */
export const AUDIT_HISTORY_DAYS = 90;

/** How many days of requests to load */
export const REQUEST_HISTORY_DAYS = 30;

/** Days to look back for the 7-day baseline checkouts average */
export const BASELINE_DAYS = 7;

/** Hospital timezone (also available via APP_TIMEZONE env var) */
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

// ──────────────────────────────────────────────────────────
// AI / LLM CONFIGURATION
// All values can be overridden via environment variables.
// The functions below read env vars at call time so they are
// testable without Deno.env stubs.
// ──────────────────────────────────────────────────────────

export type AIProvider = 'gemini' | 'anthropic';

export interface ProviderConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

/**
 * Resolve the primary LLM provider config from env vars.
 * AI_PROVIDER  – 'gemini' (default) or 'anthropic'
 * AI_MODEL     – model id (provider-specific default if absent)
 * GEMINI_API_KEY / ANTHROPIC_API_KEY – provider key
 */
export function getPrimaryConfig(): ProviderConfig {
  const provider = ((Deno.env.get('AI_PROVIDER') ?? 'gemini').toLowerCase()) as AIProvider;
  if (provider === 'anthropic') {
    return {
      provider: 'anthropic',
      model: Deno.env.get('AI_MODEL') ?? 'claude-haiku-4-5-20251001',
      apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
    };
  }
  return {
    provider: 'gemini',
    model: Deno.env.get('AI_MODEL') ?? 'gemini-2.5-flash',
    apiKey: Deno.env.get('GEMINI_API_KEY') ?? '',
  };
}

/**
 * Resolve the backup LLM provider config from env vars.
 * AI_BACKUP_PROVIDER – defaults to AI_PROVIDER
 * AI_BACKUP_MODEL    – defaults to AI_FALLBACK_MODEL (backward-compat) then a
 *                      provider-specific default
 * The backup deliberately falls back to the same provider so existing setups that
 * only set AI_FALLBACK_MODEL continue to work.
 */
export function getBackupConfig(): ProviderConfig {
  const primaryProvider = ((Deno.env.get('AI_PROVIDER') ?? 'gemini').toLowerCase()) as AIProvider;
  const backupProvider = ((
    Deno.env.get('AI_BACKUP_PROVIDER') ?? Deno.env.get('AI_PROVIDER') ?? 'gemini'
  ).toLowerCase()) as AIProvider;

  // AI_FALLBACK_MODEL is the old env var name — keep backward compat
  const legacyFallback = Deno.env.get('AI_FALLBACK_MODEL');

  if (backupProvider === 'anthropic') {
    const backupModel =
      Deno.env.get('AI_BACKUP_MODEL') ??
      (primaryProvider === 'anthropic' ? legacyFallback : null) ??
      'claude-haiku-4-5-20251001';
    return {
      provider: 'anthropic',
      model: backupModel,
      apiKey:
        Deno.env.get('ANTHROPIC_API_KEY') ?? // same key, different model is fine
        '',
    };
  }

  // Gemini backup
  const backupModel =
    Deno.env.get('AI_BACKUP_MODEL') ??
    (primaryProvider === 'gemini' ? legacyFallback : null) ??
    'gemini-2.0-flash-lite';
  return {
    provider: 'gemini',
    model: backupModel,
    apiKey: Deno.env.get('GEMINI_API_KEY') ?? '',
  };
}

// ── Timing ──────────────────────────────────────────────

/** Per-attempt HTTP timeout in ms (default 25 s) */
export const LLM_TIMEOUT_MS = (): number =>
  parseInt(Deno.env.get('LLM_TIMEOUT_MS') ?? '25000', 10);

/** Total wall-clock budget across all LLM calls (default 100 s) */
export const LLM_TOTAL_BUDGET_MS = (): number =>
  parseInt(Deno.env.get('LLM_TOTAL_BUDGET_MS') ?? '100000', 10);

/** Gap between sequential LLM calls in ms (default 1.5 s) */
export const LLM_GAP_MS = (): number =>
  parseInt(Deno.env.get('LLM_GAP_MS') ?? '1500', 10);

// ── Payload size budgets (chars) ─────────────────────────

/**
 * Maximum characters for the minified LLM user payload per feature.
 * Trimming is applied progressively if the payload exceeds this.
 */
export const MAX_USER_PAYLOAD_CHARS: Record<string, number> = {
  morning_brief: 3500,
  forgotten_equipment: 3000,
  rebalancing: 2500,
};

// ── Output token budgets ─────────────────────────────────

/**
 * Compute dynamic output token budget based on item count.
 * Returns a reasonable cap. If a call ends truncated, the caller may
 * retry with 1.5× this value (capped at the hard max).
 */
export function outputTokenBudget(
  feature: 'morning_brief' | 'forgotten_equipment' | 'rebalancing',
  itemCount: number,
): { initial: number; max: number } {
  switch (feature) {
    case 'morning_brief':
      return { initial: 600, max: 800 };
    case 'forgotten_equipment':
      return {
        initial: Math.min(150 + 110 * Math.max(itemCount, 1), 1200),
        max: 1200,
      };
    case 'rebalancing':
      return {
        initial: Math.min(150 + 160 * Math.max(itemCount, 1), 900),
        max: 900,
      };
  }
}
