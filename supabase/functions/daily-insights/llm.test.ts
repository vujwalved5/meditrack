import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { callLLM } from "./llm.ts";

// @ts-ignore: TS json module resolution requires config
import golden from "../../../t_golden.json" with { type: "json" };

Deno.test("Daily request body for gemini-3.5-flash-lite matches golden exactly", async () => {
  let capturedBody = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (init && init.body) capturedBody = JSON.parse(init.body as string);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }), { status: 200 });
  };
  
  try {
    const mockDb = { from: () => ({ insert: () => Promise.resolve() }) };
    await callLLM('morning_brief', 'hello', 1, (obj): obj is any => true, () => null, () => ({}), mockDb, { totalBudgetMs: 120000, usedMs: 0 }, {
      modelOverride: { 
        primary: { provider: 'gemini', model: 'gemini-3.5-flash-lite', apiKey: 'fake' },
        backup: { provider: 'gemini', model: 'gemini-3.5-flash-lite', apiKey: 'fake' }
      }
    });
    // Must match byte for byte (meaning identical JSON string representation)
    assertEquals(JSON.stringify(capturedBody), JSON.stringify(golden.daily['gemini-3.5-flash-lite']));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("Daily request body for gemini-3.5-flash matches golden exactly", async () => {
  let capturedBody = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (init && init.body) capturedBody = JSON.parse(init.body as string);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }), { status: 200 });
  };
  
  try {
    const mockDb = { from: () => ({ insert: () => Promise.resolve() }) };
    await callLLM('morning_brief', 'hello', 1, (obj): obj is any => true, () => null, () => ({}), mockDb, { totalBudgetMs: 120000, usedMs: 0 }, {
      modelOverride: { 
        primary: { provider: 'gemini', model: 'gemini-3.5-flash', apiKey: 'fake' },
        backup: { provider: 'gemini', model: 'gemini-3.5-flash', apiKey: 'fake' }
      }
    });
    assertEquals(JSON.stringify(capturedBody), JSON.stringify(golden.daily['gemini-3.5-flash']));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("Weekly request body for gemini-3.5-flash-lite does NOT contain thinkingConfig", async () => {
  let capturedBody: any = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (init && init.body) capturedBody = JSON.parse(init.body as string);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }), { status: 200 });
  };
  
  try {
    const mockDb = { from: () => ({ insert: () => Promise.resolve() }) };
    await callLLM('morning_brief', 'hello', 1, (obj): obj is any => true, () => null, () => ({}), mockDb, { totalBudgetMs: 120000, usedMs: 0 }, {
      thinkingBudget: 0,
      modelOverride: { 
        primary: { provider: 'gemini', model: 'gemini-3.5-flash-lite', apiKey: 'fake' },
        backup: { provider: 'gemini', model: 'gemini-3.5-flash-lite', apiKey: 'fake' }
      }
    });
    // Weekly requests explicitly pass thinkingBudget: 0
    // But for 3.5-flash-lite, it should NOT send thinkingConfig at all.
    assertEquals(capturedBody.generationConfig?.thinkingConfig, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
