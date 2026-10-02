// ============================================================
// config.ts — Configuration for weekly deep analysis
// ============================================================

import { getPrimaryConfig, getBackupConfig, ProviderConfig } from '../daily-insights/config.ts';

export const MAX_SECTION_PAYLOAD_CHARS: Record<string, number> = {
  utilization: 3000,
  demand: 2200,
  health: 2500,
  handling: 1800,
  rebalancing: 2500,
  executive: 2200,
};

export const WEEKLY_TOTAL_BUDGET_MS = (): number =>
  parseInt(Deno.env.get('WEEKLY_TOTAL_BUDGET_MS') ?? '120000', 10);

export const WEEKLY_STEP_TIMEOUT_MS = (): number =>
  parseInt(Deno.env.get('WEEKLY_STEP_TIMEOUT_MS') ?? '25000', 10);

export function getDeepModelConfig(): ProviderConfig {
  const provider = ((Deno.env.get('AI_DEEP_PROVIDER') ?? Deno.env.get('AI_PROVIDER') ?? 'gemini').toLowerCase()) as 'gemini' | 'anthropic';
  
  if (provider === 'anthropic') {
    return {
      provider: 'anthropic',
      model: Deno.env.get('AI_DEEP_MODEL') ?? Deno.env.get('AI_MODEL') ?? 'claude-haiku-4-5-20251001',
      apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
    };
  }
  
  return {
    provider: 'gemini',
    model: Deno.env.get('AI_DEEP_MODEL') ?? Deno.env.get('AI_MODEL') ?? 'gemini-2.5-flash',
    apiKey: Deno.env.get('GEMINI_API_KEY') ?? '',
  };
}

export function getWeeklyBackupConfig(): ProviderConfig {
  return getBackupConfig(); // Reuse daily backup config
}

export const MAINT_REVIEW_HOURS = 120;
export const MAINT_REVIEW_CHECKOUTS = 40;

/**
 * Per-equipment-type maintenance review thresholds.
 * Key is equip_type (lowercase, spaces allowed, same as Equipment.equip_type).
 * Falls back to MAINT_REVIEW_HOURS / MAINT_REVIEW_CHECKOUTS when type not listed.
 */
export interface MaintThreshold {
  hours: number;
  checkouts: number;
}

/**
 * Sensible per-type defaults. High-intensity ICU equipment reviewed more often;
 * low-intensity mobility equipment reviewed less often.
 * Keys are lowercase with spaces removed (matching normalizeType in weeklyMetrics.ts).
 */
export const MAINT_REVIEW_THRESHOLDS: Record<string, MaintThreshold> = {
  // Critical life-support — tighter review cadence
  'ventilator':      { hours: 80,  checkouts: 25 },
  'defibrillator':   { hours: 80,  checkouts: 20 },
  'defib':           { hours: 80,  checkouts: 20 },
  // General-use medical devices — default-ish
  'infusionpump':    { hours: 120, checkouts: 40 },
  'monitor':         { hours: 120, checkouts: 40 },
  'portablemonitor': { hours: 120, checkouts: 40 },
  // Low-intensity mobility equipment — relaxed cadence
  'wheelchair':      { hours: 200, checkouts: 60 },
  // Note: 'wheel chair' normalizes to 'wheelchair' via getMaintThreshold
};

/**
 * Return the maintenance review threshold for a given equipment type key.
 * Normalizes by lowercasing and removing all spaces before lookup,
 * matching the normalizeType() function in weeklyMetrics.ts.
 * Falls back to global defaults when the type has no specific entry.
 */
export function getMaintThreshold(equip_type: string): MaintThreshold {
  const key = equip_type.toLowerCase().replace(/\s+/g, '').trim();
  return MAINT_REVIEW_THRESHOLDS[key] ?? { hours: MAINT_REVIEW_HOURS, checkouts: MAINT_REVIEW_CHECKOUTS };
}
