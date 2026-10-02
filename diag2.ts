
import { attachOwners } from "./supabase/functions/weekly-insights/weeklyMetrics.ts";
import { fallbackFor } from "./supabase/functions/weekly-insights/weeklyPrompts.ts";

const fakeAI = [{ref: "invented", action: "do something", reason: "AI said so"}];
const attached = attachOwners(fakeAI);
console.log("Attached length:", attached.length);

const fakeFacts = {
  overall: { checkouts: 42, util_pct: 35 },
  issues: [{ ref: "out_of_order", area: "health", text_facts: "Monitor is broken" }]
};
const fd = fallbackFor("executive", fakeFacts, "no_data");
console.log("Fallback actions length:", fd.actions.length);
console.log("Fallback actions:", fd.actions);

