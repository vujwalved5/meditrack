
import { computeWeeklyMetrics, attachOwners } from "./supabase/functions/weekly-insights/weeklyMetrics.ts";
import { fallbackFor } from "./supabase/functions/weekly-insights/weeklyPrompts.ts";
import { loadAppData } from "./supabase/functions/daily-insights/data.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
const now = new Date("2023-01-08T00:00:00Z"); // arbitrary
const data = await loadAppData(db, now);
const metrics = computeWeeklyMetrics(data, now, "Asia/Kolkata");

const factData = { ...(metrics.metrics as any), verdict: metrics.verdict, section_summaries: [] };
const fd = fallbackFor("executive", factData, "no_data");
console.log("fallback actions:", fd.actions);
const attached = attachOwners(fd.actions);
console.log("attached:", attached);

