// ============================================================
// config.ts — All threshold constants for daily-insights
// ============================================================

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

/** Rebalancing: max candidates to store */
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
