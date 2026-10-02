
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { processExecutiveActions, OWNER_MAP } from "./supabase/functions/weekly-insights/weeklyMetrics.ts";

Deno.test("Task 1: AI output with zero valid refs -> actions non-empty, <= 5, owner/priority from mapping", () => {
  const issues = [
    { ref: "out_of_order", text_facts: "Device is broken" },
    { ref: "needs_maint", text_facts: "Needs maintenance" },
  ];
  const aiOutput = [{ ref: "invalid_ref", action: "Test", reason: "AI" }]; // zero valid refs
  
  const result = processExecutiveActions(aiOutput, issues);
  
  assertEquals(result.length, 2, "Should fallback to issues");
  assertEquals(result[0].ref, "out_of_order");
  assertEquals(result[0].owner, OWNER_MAP["out_of_order"].owner);
  assertEquals(result[1].ref, "needs_maint");
  assertEquals(result[1].owner, OWNER_MAP["needs_maint"].owner);
});

Deno.test("Task 1: valid AI refs -> those actions kept with mapped owner/priority", () => {
  const issues = [{ ref: "req_slow", text_facts: "Slow requests" }];
  const aiOutput = [{ ref: "req_slow", action: "Fix speed.", reason: "AI" }];
  
  const result = processExecutiveActions(aiOutput, issues);
  
  assertEquals(result.length, 1, "Should keep valid AI action");
  assertEquals(result[0].ref, "req_slow");
  assertEquals(result[0].action, "Fix speed", "Should strip punctuation");
  assertEquals(result[0].owner, OWNER_MAP["req_slow"].owner);
});

Deno.test("Task 1: fixture with NO issues -> actions may be empty and nothing crashes", () => {
  const aiOutput = [{ ref: "invalid_ref", action: "Test", reason: "AI" }];
  const result = processExecutiveActions(aiOutput, []);
  
  assertEquals(result.length, 0, "Empty issues means empty actions");
});

