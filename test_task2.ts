
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stripLimitedDataWording } from "./supabase/functions/weekly-insights/weeklyMetrics.ts";
import { WEEKLY_PROMPT_VERSION, WEEKLY_SYSTEM_PROMPT } from "./supabase/functions/weekly-insights/weeklyPrompts.ts";
import { toWeeklyPayload } from "./supabase/functions/weekly-insights/weeklyCompact.ts";

Deno.test("Task 2: is_thin false + caveat history is limited -> caveat stripped", () => {
  const caveat = "This is a finding. History is limited, so conclusions are modest. Something else.";
  const result = stripLimitedDataWording(caveat, false);
  assertEquals(result, "This is a finding. Something else.");
});

Deno.test("Task 2: is_thin true + same caveat -> kept", () => {
  const caveat = "This is a finding. History is limited, so conclusions are modest. Something else.";
  const result = stripLimitedDataWording(caveat, true);
  assertEquals(result, caveat);
});

Deno.test("Task 2: caveat without history wording -> untouched", () => {
  const caveat = "This is a finding. There are some other caveats. Something else.";
  const result = stripLimitedDataWording(caveat, false);
  assertEquals(result, caveat);
});

Deno.test("Task 2: system prompt string contains new rule", () => {
  assert(WEEKLY_SYSTEM_PROMPT.includes("Mention limited history or limited data ONLY when thin_data is present"));
});

Deno.test("Task 2: payload builder omits thin_data when not thin", () => {
  const payload1 = toWeeklyPayload("test", { data_quality: { is_thin: true } });
  assert("thin_data" in payload1.payload, "thin_data should be present when is_thin is true");
  
  const payload2 = toWeeklyPayload("test", { data_quality: { is_thin: false } });
  assert(!("thin_data" in payload2.payload), "thin_data should be omitted when is_thin is false");
});

Deno.test("Task 2: WEEKLY_PROMPT_VERSION changed", () => {
  assertEquals(WEEKLY_PROMPT_VERSION, "w4");
});

