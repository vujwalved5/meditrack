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
