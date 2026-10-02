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

import { sanitizeAIText } from "./orchestration.ts";

Deno.test("Task 1: AI finding with mapped id replaces with real name", () => {
  const map = { m1: "Ventilator A" };
  const text = "Item m1 had 14 checkouts since last check";
  const result = sanitizeAIText(text, map);
  assertEquals(result, "Item Ventilator A had 14 checkouts since last check");
});

Deno.test("Task 1: AI finding with m1, m2, m3 replaces all in single pass", () => {
  const map = { m1: "Ventilator", m2: "Pump", m3: "Bed" };
  const text = "Check m1, then m2, and m3.";
  const result = sanitizeAIText(text, map);
  assertEquals(result, "Check Ventilator, then Pump, and Bed.");
});

Deno.test("Task 1: Unmappable id discards finding", () => {
  const map = { m1: "Ventilator A" };
  const text = "Item m9 had 14 checkouts";
  const result = sanitizeAIText(text, map);
  assertEquals(result, null);
});

Deno.test("Task 1: Real item name containing id stays untouched", () => {
  const map = { m1: "Ventilator A" };
  const text = "Item Pump C1 is fine, Monitor M1 is good, and m1 is bad.";
  const result = sanitizeAIText(text, map);
  assertEquals(result, "Item Pump C1 is fine, Monitor M1 is good, and Ventilator A is bad.");
});

Deno.test("Task 1: Id from another section discards finding", () => {
  const map = { m1: "Ventilator A" };
  // c1 is an id-like token but not in this section's map
  const text = "Item c1 needs review.";
  const result = sanitizeAIText(text, map);
  assertEquals(result, null);
});

Deno.test("Task 1: No ids present keeps text unchanged", () => {
  const map = { m1: "Ventilator A" };
  const text = "All items are working normally.";
  const result = sanitizeAIText(text, map);
  assertEquals(result, "All items are working normally.");
});

