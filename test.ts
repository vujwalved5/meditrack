import { callWeeklyLLM } from './supabase/functions/weekly-insights/orchestration.ts';
import { fallbackFor, validateWeeklySection, getWeeklySchema } from './supabase/functions/weekly-insights/weeklyPrompts.ts';
import { attachOwners } from './supabase/functions/weekly-insights/index.ts';

const issues = [
  { ref: 'out_of_order', area: 'health', severity: 'critical', text_facts: 'Item broken', score: 95 }
];

console.log(fallbackFor('executive', { verdict: { issues } }).actions);
