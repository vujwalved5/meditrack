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
