import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { callWeeklyLLM, deps } from "./orchestration.ts";

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
