import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { callWeeklyLLM, deps } from "./orchestration.ts";
import { WEEKLY_GAP_MS } from "./config.ts";

Deno.test("Config - WEEKLY_GAP_MS falls back properly", () => {
  const orig = Deno.env.get('WEEKLY_GAP_MS');
  
  try {
    Deno.env.delete('WEEKLY_GAP_MS');
    assertEquals(WEEKLY_GAP_MS(), 4000);
    
    Deno.env.set('WEEKLY_GAP_MS', '1500');
    assertEquals(WEEKLY_GAP_MS(), 1500);
    
    Deno.env.set('WEEKLY_GAP_MS', 'abc');
    assertEquals(WEEKLY_GAP_MS(), 4000);
    
    Deno.env.set('WEEKLY_GAP_MS', '');
    assertEquals(WEEKLY_GAP_MS(), 4000);
    
    Deno.env.set('WEEKLY_GAP_MS', '-5');
    assertEquals(WEEKLY_GAP_MS(), 4000);
  } finally {
    if (orig !== undefined) Deno.env.set('WEEKLY_GAP_MS', orig);
    else Deno.env.delete('WEEKLY_GAP_MS');
  }
});

Deno.test("Weekly orchestration - primary skips rest of run on auth_or_config", async () => {
  let callCount = 0;
  const originalFetch = globalThis.fetch;
  const originalSleep = deps.sleep;
  const originalNow = deps.now;
  
  try {
    deps.sleep = () => Promise.resolve();
    let time = 1000;
    deps.now = () => { time += 10; return time; };
    
    globalThis.fetch = async () => {
      callCount++;
      return new Response("Unauthorized", { status: 401 });
    };

    const runState = { primaryAuthFailed: false, authFailureLogged: false };
    const db = { from: () => ({ insert: () => Promise.resolve() }) };
    
    const r1 = await callWeeklyLLM(
      "sec1", "hello", (obj): obj is any => true, () => null, () => ({ fb: 1 }),
      db, { totalBudgetMs: 120000, usedMs: 0 },
      { maxOutputTokens: 100, timeoutMs: 10000, primary: { provider: "gemini", model: "x", apiKey: "" }, schema: {}, toolName: "", logType: "", systemPrompt: "", thinkingBudget: 0 },
      runState
    );
    
    assertEquals(callCount, 1);
    assertEquals(r1.usedFallback, true);
    assertEquals(runState.primaryAuthFailed, true);
    
    const r2 = await callWeeklyLLM(
      "sec2", "hello", (obj): obj is any => true, () => null, () => ({ fb: 2 }),
      db, { totalBudgetMs: 120000, usedMs: 0 },
      { maxOutputTokens: 100, timeoutMs: 10000, primary: { provider: "gemini", model: "x", apiKey: "" }, schema: {}, toolName: "", logType: "", systemPrompt: "", thinkingBudget: 0 },
      runState
    );
    
    // Should NOT call fetch again
    assertEquals(callCount, 1);
    assertEquals(r2.usedFallback, true);
  } finally {
    globalThis.fetch = originalFetch;
    deps.sleep = originalSleep;
    deps.now = originalNow;
  }
});

Deno.test("Weekly orchestration - 3 attempts with backoff", async () => {
  let callCount = 0;
  const originalFetch = globalThis.fetch;
  const originalSleep = deps.sleep;
  const originalNow = deps.now;
  
  try {
    deps.sleep = () => Promise.resolve();
    let time = 1000;
    deps.now = () => { time += 10; return time; };
    
    globalThis.fetch = async () => {
      callCount++;
      return new Response("Overloaded", { status: 503 });
    };

    const runState = { primaryAuthFailed: false, authFailureLogged: false };
    const db = { from: () => ({ insert: () => Promise.resolve() }) };
    
    const r1 = await callWeeklyLLM(
      "sec1", "hello", (obj): obj is any => true, () => null, () => ({ fb: 1 }),
      db, { totalBudgetMs: 120000, usedMs: 0 },
      { maxOutputTokens: 100, timeoutMs: 10000, primary: { provider: "gemini", model: "x", apiKey: "" }, schema: {}, toolName: "", logType: "", systemPrompt: "", thinkingBudget: 0 },
      runState
    );
    
    assertEquals(callCount, 3);
    assertEquals(r1.usedFallback, true);
  } finally {
    globalThis.fetch = originalFetch;
    deps.sleep = originalSleep;
    deps.now = originalNow;
  }
});

Deno.test("Weekly orchestration - stops retry when remaining budget < WEEKLY_GAP_MS", async () => {
  let callCount = 0;
  const originalFetch = globalThis.fetch;
  const originalSleep = deps.sleep;
  const originalNow = deps.now;
  const origGap = Deno.env.get('WEEKLY_GAP_MS');
  
  try {
    Deno.env.set('WEEKLY_GAP_MS', '4000');
    deps.sleep = () => Promise.resolve();
    let time = 1000;
    deps.now = () => { time += 10; return time; };
    
    globalThis.fetch = async () => {
      callCount++;
      return new Response("Overloaded", { status: 503 });
    };

    const runState = { primaryAuthFailed: false, authFailureLogged: false };
    const db = { from: () => ({ insert: () => Promise.resolve() }) };
    
    // Total budget is 10000, used is 7000. Remaining is 3000.
    // 3000 < WEEKLY_GAP_MS() (which is 4000). 
    // It should attempt ONCE and then break without retrying.
    const r1 = await callWeeklyLLM(
      "sec1", "hello", (obj): obj is any => true, () => null, () => ({ fb: 1 }),
      db, { totalBudgetMs: 10000, usedMs: 7000 },
      { maxOutputTokens: 100, timeoutMs: 10000, primary: { provider: "gemini", model: "x", apiKey: "" }, schema: {}, toolName: "", logType: "", systemPrompt: "", thinkingBudget: 0 },
      runState
    );
    
    assertEquals(callCount, 1);
    assertEquals(r1.usedFallback, true);
  } finally {
    globalThis.fetch = originalFetch;
    deps.sleep = originalSleep;
    deps.now = originalNow;
    if (origGap !== undefined) Deno.env.set('WEEKLY_GAP_MS', origGap);
    else Deno.env.delete('WEEKLY_GAP_MS');
  }
});
