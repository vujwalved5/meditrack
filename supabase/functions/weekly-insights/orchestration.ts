import { ProviderConfig, OneAttemptResult, callProviderOnce, RETRYABLE_CATS, AttemptRecord, writeRunLog } from '../daily-insights/llm.ts';
import { WEEKLY_GAP_MS } from './config.ts';

export const deps = {
  sleep: (ms: number) => new Promise<void>(r => setTimeout(r, ms)),
  now: () => Date.now(),
};

function jitter(ms: number) { return ms + Math.random() * 500; }

export async function callWeeklyLLM<T>(
  feature: string,
  userPrompt: string,
  validator: (obj: unknown) => obj is T,
  coerce: (obj: unknown) => T | null,
  fallback: () => T,
  db: any,
  budgetCtx: { totalBudgetMs: number; usedMs: number },
  opts: {
    maxOutputTokens: number;
    timeoutMs: number;
    primary: ProviderConfig;
    schema: any;
    toolName: string;
    logType: string;
    systemPrompt: string;
    thinkingBudget: number;
  },
  runState: { primaryAuthFailed: boolean; authFailureLogged: boolean }
): Promise<{ data: T; model: string; usedFallback: boolean; attempts: AttemptRecord[] }> {

  const promptChars = userPrompt.length;
  const estTokens = Math.round(promptChars / 4);
  const attempts: AttemptRecord[] = [];

  const remaining = () => budgetCtx.totalBudgetMs - budgetCtx.usedMs;
  const timeoutMs = () => Math.min(opts.timeoutMs, remaining());

  async function attempt(
    cfg: ProviderConfig,
    attemptNum: number,
    maxTokens: number,
  ): Promise<{ result: OneAttemptResult; rec: AttemptRecord }> {
    const tmOut = timeoutMs();
    const controller = new AbortController();
    
    // Injectable clock for timer
    let timerFired = false;
    let timerId: any = undefined;
    
    // In real env, we use setTimeout. In tests with mocked deps.now, we might need a mocked timer, 
    // but the AbortSignal is tied to real time. For tests, we assume fetch won't stall.
    timerId = setTimeout(() => { timerFired = true; controller.abort(); }, tmOut);
    
    const tStart = deps.now();
    let res: OneAttemptResult;
    try {
      res = await callProviderOnce(cfg, userPrompt, maxTokens, feature, controller.signal, opts);
    } finally {
      clearTimeout(timerId);
    }
    const realLatency = deps.now() - tStart;
    res.latencyMs = realLatency;
    budgetCtx.usedMs += realLatency;

    const rec: AttemptRecord = {
      provider: cfg.provider,
      model: cfg.model,
      attempt: attemptNum,
      outcome: !res.errorCategory ? 'success' : 'failure',
      http_status: res.httpStatus,
      error_category: res.errorCategory ?? null,
      latency_ms: realLatency,
      prompt_chars: promptChars,
      est_tokens: estTokens,
      ...(res.retryAfterMs ? { retry_after_ms: res.retryAfterMs } : {}),
      ...(res.errorMessage ? { error_message: res.errorMessage } : {}),
    };

    console.log(
      `[weekly-llm] feature=${feature} provider=${cfg.provider} model=${cfg.model} ` +
      `attempt=${attemptNum} outcome=${rec.outcome} ` +
      `status=${res.httpStatus} cat=${res.errorCategory ?? 'none'} ` +
      `latency=${realLatency}ms tokens_est=${estTokens}`,
    );

    attempts.push(rec);
    writeRunLog(db, { type: opts.logType, ...rec });

    return { result: res, rec };
  }

  // ── "Per run, if a model returns auth_or_config, skip it for the rest of that run and log ONE 'primary_skipped' row." ──
  if (runState.primaryAuthFailed) {
    if (!runState.authFailureLogged) {
      console.warn(`[weekly] Primary skipped due to earlier auth_or_config error.`);
      const skipRec = { type: opts.logType, provider: opts.primary.provider, model: opts.primary.model, attempt: 0, outcome: 'failure', http_status: 0, error_category: 'auth_or_config', latency_ms: 0, prompt_chars: promptChars, est_tokens: estTokens, error_message: 'primary_skipped' };
      writeRunLog(db, skipRec);
      runState.authFailureLogged = true;
    }
    return { data: fallback(), model: 'fallback', usedFallback: true, attempts };
  }

  // ── "The live model gets up to 3 attempts with backoff 2s, 6s, 15s plus jitter." ──
  const backoffs = [2000, 6000, 15000];
  let currentMaxTokens = opts.maxOutputTokens;

  for (let i = 1; i <= 3; i++) {
    const r = await attempt(opts.primary, i, currentMaxTokens);
    
    if (!r.result.errorCategory) {
      if (validator(r.result.raw)) {
        return { data: r.result.raw, model: opts.primary.model, usedFallback: false, attempts };
      }
      const coerced = coerce(r.result.raw);
      if (coerced != null) {
        return { data: coerced, model: opts.primary.model, usedFallback: false, attempts };
      }
    }

    const cat = r.result.errorCategory;
    if (cat === 'auth_or_config') {
      runState.primaryAuthFailed = true;
      runState.authFailureLogged = true;
      const skipRec = { type: opts.logType, provider: opts.primary.provider, model: opts.primary.model, attempt: i, outcome: 'failure', http_status: r.result.httpStatus, error_category: 'auth_or_config', latency_ms: r.result.latencyMs, prompt_chars: promptChars, est_tokens: estTokens, error_message: r.result.errorMessage ?? 'primary_skipped' };
      writeRunLog(db, skipRec);
      break; // stop trying
    }

    if (i < 3 && cat && RETRYABLE_CATS.includes(cat)) {
      if (remaining() < WEEKLY_GAP_MS()) break; // Not enough budget to retry
      
      let delayMs = jitter(backoffs[i - 1]);
      if (cat === 'rate_limited') {
        const retryAfter = r.result.retryAfterMs ?? 0;
        if (retryAfter > 0 && retryAfter <= 20000) {
          delayMs = retryAfter;
        } else if (retryAfter > 20000) {
          break; // Honor Retry-After when it is 20s or less. So >20s means don't retry.
        }
      }
      
      if (cat === 'truncated') {
        currentMaxTokens = Math.min(Math.round(currentMaxTokens * 1.5), 8000);
      }

      await deps.sleep(delayMs);
    } else if (!cat || !RETRYABLE_CATS.includes(cat)) {
      break;
    }
  }

  console.warn(`[weekly] All LLM attempts failed for ${feature}. Using fallback.`);
  return { data: fallback(), model: 'fallback', usedFallback: true, attempts };
}

export function buildIdMap(section: string, payload: any): Record<string, string> {
  const map: Record<string, string> = {};
  if (!payload || typeof payload !== 'object') return map;
  if (section === 'health' && Array.isArray(payload.usage_review_candidates)) {
    for (const m of payload.usage_review_candidates) {
      if (m.id && m.item) map[m.id] = m.item;
    }
  } else if (section === 'rebalancing') {
    if (Array.isArray(payload.moves)) {
      for (const m of payload.moves) {
        if (m.id && m.item) map[m.id] = m.item;
      }
    }
    if (Array.isArray(payload.purchasing_signals)) {
      for (const p of payload.purchasing_signals) {
        if (p.id && p.type) map[p.id] = p.type;
      }
    }
  }
  return map;
}

export function sanitizeAIText(text: string | null | undefined, idMap: Record<string, string>): string | null {
  if (typeof text !== 'string' || text === '') return text ?? null;
  const knownIds = Object.keys(idMap);
  let replaced = text;
  if (knownIds.length > 0) {
    // Sort descending by length so longer IDs replace first (not strictly needed since IDs are same length, but good practice)
    const sorted = [...knownIds].sort((a, b) => b.length - a.length);
    const regex = new RegExp(`\\b(${sorted.join('|')})\\b`, 'g');
    replaced = text.replace(regex, match => idMap[match]);
  }
  const idLikeRegex = /\b([mcpf]\d+)\b/g;
  let m;
  const realNames = Object.values(idMap);
  while ((m = idLikeRegex.exec(replaced)) !== null) {
    const token = m[1];
    let covered = false;
    for (const name of realNames) {
      let idx = replaced.indexOf(name);
      while (idx !== -1) {
        if (m.index >= idx && m.index < idx + name.length) {
          covered = true; break;
        }
        idx = replaced.indexOf(name, idx + 1);
      }
      if (covered) break;
    }
    if (!covered) return null;
  }
  return replaced;
}

export function applySanitization(secData: any, fallbackData: any, idMap: Record<string, string>): any {
  if (!secData || typeof secData !== 'object') return secData;
  const result = { ...secData };

  const check = (str: string | undefined): string | null => {
     if (typeof str !== 'string') return str as any;
     return sanitizeAIText(str, idMap);
  };

  if (result.summary) {
    const s = check(result.summary);
    if (s === null) result.summary = fallbackData.summary;
    else result.summary = s;
  }
  if (result.headline) {
    const s = check(result.headline);
    if (s === null) result.headline = fallbackData.headline || 'Summary';
    else result.headline = s;
  }

  const arrays = ['findings', 'maintenance', 'moves', 'purchasing', 'actions'];
  for (const arrName of arrays) {
    if (Array.isArray(result[arrName])) {
      const cleanArr = [];
      const fallbacks = fallbackData[arrName] || [];
      for (let i = 0; i < result[arrName].length; i++) {
        const item = { ...result[arrName][i] };
        let failed = false;
        for (const k of Object.keys(item)) {
          if (typeof item[k] === 'string') {
            const s = check(item[k]);
            if (s === null) { failed = true; break; }
            item[k] = s;
          }
        }
        if (failed) {
           if (i < fallbacks.length) cleanArr.push(fallbacks[i]);
        } else {
           cleanArr.push(item);
        }
      }
      result[arrName] = cleanArr;
    }
  }

  return result;
}
