// ============================================================
// llm.ts — Provider abstraction, error classification, retry, fallback
// ============================================================
// Design notes:
//  - Primary/backup configs come from config.ts (single source of truth)
//  - Every attempt is classified into one error_category
//  - Retry policy is category-specific (see STEP 4 spec)
//  - Native structured output: Gemini responseSchema, Anthropic tool use
//  - parseJsonResponse kept as secondary path
// ============================================================

import {
  SYSTEM_PROMPT,
  BRIEF_RESPONSE_SCHEMA, BRIEF_INPUT_SCHEMA,
  FORGOTTEN_RESPONSE_SCHEMA, FORGOTTEN_INPUT_SCHEMA,
  REBALANCING_RESPONSE_SCHEMA, REBALANCING_INPUT_SCHEMA,
} from './prompts.ts';
import {
  getPrimaryConfig, getBackupConfig, ProviderConfig,
  LLM_TIMEOUT_MS, outputTokenBudget,
} from './config.ts';

// ──────────────────────────────────────────────────────────
// Error categories
// ──────────────────────────────────────────────────────────

export type ErrorCategory =
  | 'timeout'
  | 'rate_limited'     // 429
  | 'overloaded'       // 500/502/503/504
  | 'auth_or_config'   // 400/401/403/404
  | 'blocked_or_empty' // no text / safety block / empty candidates
  | 'truncated'        // MAX_TOKENS finish reason
  | 'bad_json'
  | 'schema_invalid'
  | 'network';

/**
 * Classify an error into one ErrorCategory.
 * @param status   HTTP status (0 = no HTTP response)
 * @param bodyText Response body snippet (max 200 chars)
 * @param finishReason Gemini finishReason or Anthropic stop_reason
 */
export function classifyError(
  status: number,
  bodyText: string,
  finishReason?: string,
): ErrorCategory {
  if (finishReason === 'MAX_TOKENS' || finishReason === 'max_tokens') return 'truncated';
  if (finishReason && !['STOP', 'stop', 'end_turn', 'tool_use'].includes(finishReason)) {
    return 'blocked_or_empty';
  }
  if (status === 429) return 'rate_limited';
  if ([500, 502, 503, 504].includes(status)) return 'overloaded';
  if ([400, 401, 403, 404].includes(status)) return 'auth_or_config';
  if (status === 0) return 'network';
  return 'network'; // unexpected status
}

/**
 * Parse LLM response text into a JSON object robustly.
 * Strips code fences and takes the substring from first '{' to last '}'.
 */
export function parseJsonResponse(text: string): unknown {
  let s = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error('No JSON object found in LLM response');
  }
  s = s.substring(firstBrace, lastBrace + 1);
  return JSON.parse(s);
}

// ──────────────────────────────────────────────────────────
// Attempt record
// ──────────────────────────────────────────────────────────

export interface AttemptRecord {
  provider: string;
  model: string;
  attempt: number;
  outcome: 'success' | 'failure';
  http_status: number;
  error_category: ErrorCategory | null;
  latency_ms: number;
  prompt_chars: number;
  est_tokens: number;
  retry_after_ms?: number; // from Retry-After header
}

// ──────────────────────────────────────────────────────────
// Schema helpers
// ──────────────────────────────────────────────────────────

type FeatureSchema = typeof BRIEF_RESPONSE_SCHEMA;

function getSchema(feature: string): FeatureSchema {
  if (feature === 'morning_brief') return BRIEF_RESPONSE_SCHEMA;
  if (feature === 'forgotten_equipment') return FORGOTTEN_RESPONSE_SCHEMA;
  return REBALANCING_RESPONSE_SCHEMA;
}

function getInputSchema(feature: string): FeatureSchema {
  if (feature === 'morning_brief') return BRIEF_INPUT_SCHEMA;
  if (feature === 'forgotten_equipment') return FORGOTTEN_INPUT_SCHEMA;
  return REBALANCING_INPUT_SCHEMA;
}

function getToolName(feature: string): string {
  if (feature === 'morning_brief') return 'write_brief';
  if (feature === 'forgotten_equipment') return 'write_forgotten_alerts';
  return 'write_rebalancing';
}

// ──────────────────────────────────────────────────────────
// Single attempt
// ──────────────────────────────────────────────────────────

interface OneAttemptResult {
  raw: unknown;
  httpStatus: number;
  finishReason?: string;
  errorCategory?: ErrorCategory;
  retryAfterMs?: number;
  latencyMs: number;
}

async function callProviderOnce(
  cfg: ProviderConfig,
  userPrompt: string,
  maxTokens: number,
  feature: string,
  signal: AbortSignal,
): Promise<OneAttemptResult> {
  const t0 = Date.now();
  let httpStatus = 0;
  let finishReason: string | undefined;

  try {
    let response: Response;

    if (cfg.provider === 'anthropic') {
      // Anthropic forced tool use for structured output
      const toolName = getToolName(feature);
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: maxTokens,
          temperature: 0.2,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
          tools: [{
            name: toolName,
            description: 'Return the structured insight JSON',
            input_schema: getInputSchema(feature),
          }],
          tool_choice: { type: 'tool', name: toolName },
        }),
        signal,
      });

      httpStatus = response.status;
      if (!response.ok) {
        const body = await response.text().catch(() => '(no body)');
        const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'));
        const cat = classifyError(httpStatus, body);
        return { raw: null, httpStatus, finishReason, errorCategory: cat, retryAfterMs, latencyMs: Date.now() - t0 };
      }

      const data = await response.json();
      // stop_reason for tool_use is 'tool_use'
      finishReason = data?.stop_reason ?? undefined;
      if (finishReason === 'max_tokens') {
        return { raw: null, httpStatus, finishReason, errorCategory: 'truncated', latencyMs: Date.now() - t0 };
      }

      // Extract tool input
      const toolBlock = (data?.content ?? []).find((b: any) => b.type === 'tool_use');
      if (!toolBlock?.input) {
        return { raw: null, httpStatus, finishReason, errorCategory: 'blocked_or_empty', latencyMs: Date.now() - t0 };
      }
      return { raw: toolBlock.input, httpStatus, finishReason, latencyMs: Date.now() - t0 };

    } else {
      // Gemini — use responseSchema for native structured output
      const is25Flash = cfg.model.includes('2.5') && cfg.model.toLowerCase().includes('flash');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent`;

      const body: Record<string, unknown> = {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
          responseSchema: getSchema(feature),
          ...(is25Flash ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      };

      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cfg.apiKey,
        },
        body: JSON.stringify(body),
        signal,
      });

      httpStatus = response.status;
      if (!response.ok) {
        const bodyText = await response.text().catch(() => '(no body)');
        const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'));
        const cat = classifyError(httpStatus, bodyText);
        return { raw: null, httpStatus, finishReason, errorCategory: cat, retryAfterMs, latencyMs: Date.now() - t0 };
      }

      const data = await response.json();
      const cand = data?.candidates?.[0];
      finishReason = cand?.finishReason ?? undefined;

      if (finishReason === 'MAX_TOKENS') {
        return { raw: null, httpStatus, finishReason, errorCategory: 'truncated', latencyMs: Date.now() - t0 };
      }
      if (finishReason && !['STOP', undefined].includes(finishReason)) {
        return { raw: null, httpStatus, finishReason, errorCategory: 'blocked_or_empty', latencyMs: Date.now() - t0 };
      }

      const parts = (cand?.content?.parts ?? []) as any[];
      const text: string = parts
        .filter((p: any) => !p.thought)
        .map((p: any) => p.text ?? '')
        .join('');

      if (!text.trim()) {
        return { raw: null, httpStatus, finishReason, errorCategory: 'blocked_or_empty', latencyMs: Date.now() - t0 };
      }

      // With responseSchema the response should already be valid JSON, but
      // keep the robust parser as secondary path
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        try {
          parsed = parseJsonResponse(text);
        } catch {
          return { raw: null, httpStatus, finishReason, errorCategory: 'bad_json', latencyMs: Date.now() - t0 };
        }
      }

      return { raw: parsed, httpStatus, finishReason, latencyMs: Date.now() - t0 };
    }

  } catch (err) {
    const latencyMs = Date.now() - t0;
    const msg = (err as Error).message ?? '';
    if (msg.includes('AbortError') || (err as any)?.name === 'AbortError') {
      return { raw: null, httpStatus: 0, finishReason, errorCategory: 'timeout', latencyMs };
    }
    return { raw: null, httpStatus: 0, finishReason, errorCategory: 'network', latencyMs };
  }
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const n = parseFloat(header);
  if (!isNaN(n)) return Math.round(n * 1000);
  // Could be an HTTP date; skip for now
  return undefined;
}

// ──────────────────────────────────────────────────────────
// Run log persistence (fire and forget)
// ──────────────────────────────────────────────────────────

export async function writeRunLog(
  db: any,
  row: {
    type: string; provider: string; model: string; attempt: number;
    outcome: string; http_status: number; error_category: string | null;
    latency_ms: number; prompt_chars: number; est_tokens: number;
  },
): Promise<void> {
  try {
    await db.from('ai_run_log').insert([{
      type: row.type,
      provider: row.provider,
      model: row.model,
      attempt: row.attempt,
      outcome: row.outcome,
      http_status: row.http_status,
      error_category: row.error_category,
      latency_ms: row.latency_ms,
      prompt_chars: row.prompt_chars,
      est_tokens: row.est_tokens,
    }]);
  } catch {
    // Log write failure must never break the run
  }
}

// ──────────────────────────────────────────────────────────
// Retry policy helpers
// ──────────────────────────────────────────────────────────

const RETRYABLE_CATS: ErrorCategory[] = [
  'timeout', 'overloaded', 'network', 'blocked_or_empty', 'bad_json', 'truncated',
];

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function jitter(ms: number) { return ms + Math.random() * 500; }

// ──────────────────────────────────────────────────────────
// Budget context (shared across all features)
// ──────────────────────────────────────────────────────────

export interface BudgetCtx {
  totalBudgetMs: number;
  usedMs: number;
}

// ──────────────────────────────────────────────────────────
// LLM result
// ──────────────────────────────────────────────────────────

export interface LLMResult<T> {
  data: T;
  model: string;
  usedFallback: boolean;
  attempts: AttemptRecord[];
}

// ──────────────────────────────────────────────────────────
// Main entry point
// ──────────────────────────────────────────────────────────

/**
 * Call the LLM for a given feature with the retry chain:
 *   primary attempt 1 → (if retryable) primary attempt 2 → backup attempt 1 → deterministic fallback
 *
 * Never logs API keys or full prompts.
 */
export async function callLLM<T>(
  feature: 'morning_brief' | 'forgotten_equipment' | 'rebalancing',
  userPrompt: string,
  itemCount: number,
  validator: (obj: unknown) => obj is T,
  coerce: (obj: unknown) => T,
  fallback: () => T,
  db: any,
  budgetCtx: BudgetCtx,
): Promise<LLMResult<T>> {
  const primary = getPrimaryConfig();
  const backup = getBackupConfig();
  const promptChars = userPrompt.length;
  const estTokens = Math.round(promptChars / 4);
  const tokenBudget = outputTokenBudget(feature, itemCount);
  const attempts: AttemptRecord[] = [];

  let currentMaxTokens = tokenBudget.initial;

  // Returns remaining ms in global budget
  const remaining = () => budgetCtx.totalBudgetMs - budgetCtx.usedMs;
  const timeoutMs = () => Math.min(LLM_TIMEOUT_MS(), remaining());

  // ── Single timed attempt ──
  async function attempt(
    cfg: ProviderConfig,
    attemptNum: number,
    maxTokens: number,
  ): Promise<{ result: OneAttemptResult; rec: AttemptRecord }> {
    const tmOut = timeoutMs();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), tmOut);
    let res: OneAttemptResult;
    try {
      res = await callProviderOnce(cfg, userPrompt, maxTokens, feature, controller.signal);
    } finally {
      clearTimeout(timer);
    }
    budgetCtx.usedMs += res.latencyMs;

    const rec: AttemptRecord = {
      provider: cfg.provider,
      model: cfg.model,
      attempt: attemptNum,
      outcome: !res.errorCategory ? 'success' : 'failure',
      http_status: res.httpStatus,
      error_category: res.errorCategory ?? null,
      latency_ms: res.latencyMs,
      prompt_chars: promptChars,
      est_tokens: estTokens,
      ...(res.retryAfterMs ? { retry_after_ms: res.retryAfterMs } : {}),
    };

    // Compact log line (no keys, no full prompts)
    console.log(
      `[llm] feature=${feature} provider=${cfg.provider} model=${cfg.model} ` +
      `attempt=${attemptNum} outcome=${rec.outcome} ` +
      `status=${res.httpStatus} cat=${res.errorCategory ?? 'none'} ` +
      `latency=${res.latencyMs}ms tokens_est=${estTokens}`,
    );

    attempts.push(rec);
    // Fire-and-forget log write
    writeRunLog(db, { type: feature, ...rec });

    return { result: res, rec };
  }

  // ── Attempt 1: primary ──
  const r1 = await attempt(primary, 1, currentMaxTokens);

  if (!r1.result.errorCategory) {
    if (validator(r1.result.raw)) {
      return { data: r1.result.raw, model: primary.model, usedFallback: false, attempts };
    }
    const coerced = coerce(r1.result.raw);
    if (coerced != null) {
      return { data: coerced, model: primary.model, usedFallback: false, attempts };
    }
  }

  const cat1 = r1.result.errorCategory;

  // auth_or_config: skip straight to backup
  if (cat1 === 'auth_or_config') {
    console.warn(`[llm] auth_or_config on primary — skipping straight to backup`);
  } else if (cat1 && RETRYABLE_CATS.includes(cat1)) {
    // ── Attempt 2: primary retry ──
    let delayMs = jitter(1000);
    let skipToBackup = false;

    if (cat1 === 'rate_limited') {
      const retryAfter = r1.result.retryAfterMs ?? 0;
      if (retryAfter > 0 && retryAfter <= 20000) {
        delayMs = retryAfter;
      } else if (retryAfter > 20000) {
        // Too long — skip straight to backup
        console.warn(`[llm] Retry-After ${retryAfter}ms > 20s — skipping to backup`);
        skipToBackup = true;
      }
    }

    if (!skipToBackup && remaining() > LLM_TIMEOUT_MS()) {
      await sleep(delayMs);
      const r2tokens = cat1 === 'truncated'
        ? Math.min(Math.round(currentMaxTokens * 1.5), tokenBudget.max)
        : currentMaxTokens;
      const r2 = await attempt(primary, 2, r2tokens);

      if (!r2.result.errorCategory) {
        if (validator(r2.result.raw)) {
          return { data: r2.result.raw, model: primary.model, usedFallback: false, attempts };
        }
        const coerced = coerce(r2.result.raw);
        if (coerced != null) {
          return { data: coerced, model: primary.model, usedFallback: false, attempts };
        }
      }

      if (r2.result.errorCategory === 'rate_limited') {
        const retryAfter2 = r2.result.retryAfterMs ?? 0;
        if (retryAfter2 > 20000) {
          console.warn(`[llm] Retry-After ${retryAfter2}ms > 20s on primary attempt 2 — going to backup`);
        }
      }
    }
  }

  // ── Backup attempt ──
  const isSameModel = backup.model === primary.model && backup.provider === primary.provider;
  if (!isSameModel && remaining() > LLM_TIMEOUT_MS() * 0.2) {
    await sleep(jitter(3000));
    const rb = await attempt(backup, 3, currentMaxTokens);

    if (!rb.result.errorCategory) {
      if (validator(rb.result.raw)) {
        return { data: rb.result.raw, model: backup.model, usedFallback: false, attempts };
      }
      const coerced = coerce(rb.result.raw);
      if (coerced != null) {
        return { data: coerced, model: backup.model, usedFallback: false, attempts };
      }
    }
  }

  // ── Deterministic fallback ──
  console.warn(`[llm] all LLM attempts failed for ${feature}. Using deterministic fallback.`);
  return { data: fallback(), model: 'fallback', usedFallback: true, attempts };
}

// Re-export for backward compat with any code that imports AttemptRecord
export type { ProviderConfig };
