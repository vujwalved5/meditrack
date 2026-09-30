# MediTrack AI Daily Insights — Setup Guide

This document gives you the **exact commands and steps** to deploy the three AI daily insights features (v4) on your existing MediTrack project.

> **No commands involving secrets are run for you** — every step that requires your real keys is listed below as a one-liner you run yourself.

---

## Prerequisites

| Tool | Install |
|------|---------|
| Supabase CLI ≥ 1.200 | `npm install -g supabase` |
| Deno ≥ 1.43 | https://deno.com/ |
| Node 18+ | for `npx` (optional, used by Supabase CLI) |

You need:
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from your Supabase project settings → **API**
- An AI API key: [Google AI Studio (Gemini)](https://aistudio.google.com/) or [Anthropic Console](https://console.anthropic.com/)
- A random `CRON_SECRET` — generate one with:

```bash
openssl rand -hex 32
```

---

## STEP 1 — Database Migration

Open the [Supabase SQL Editor](https://app.supabase.com/project/qfgvjyhnvmcczhqicend/editor) and run **both** scripts in order:

1. `migration_v3_ai_insights.sql` — creates the `ai_insights` table, RLS, index, realtime
2. (wait until step 5 to run `migration_v3_cron.sql`)

**After running step 1**, verify:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'ai_insights' ORDER BY ordinal_position;
```

---

## STEP 2 — Seed Demo Data (optional, for testing)

In the SQL Editor, run:
```
seed_demo_history.sql
```

> ⚠️ This modifies **Wheelchair B** (sets to In Use for 19h) and **Portable Monitor** (sets to Needs Maintenance). Run the cleanup block at the bottom of that file to revert.

---

## STEP 3 — Set Supabase Secrets

Run these **one at a time** from your terminal (substitute real values):

```bash
# Supabase service role key (from project settings → API → service_role)
supabase secrets set --project-ref qfgvjyhnvmcczhqicend \
  SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# CRON_SECRET (the value you generated with openssl rand -hex 32)
supabase secrets set --project-ref qfgvjyhnvmcczhqicend \
  CRON_SECRET="your-secret-here"

# AI provider — choose ONE of:
# Option A: Gemini
supabase secrets set --project-ref qfgvjyhnvmcczhqicend \
  AI_PROVIDER="gemini" \
  AI_MODEL="gemini-2.5-flash" \
  GEMINI_API_KEY="your-gemini-api-key"

# Option B: Anthropic Claude
# supabase secrets set --project-ref qfgvjyhnvmcczhqicend \
#   AI_PROVIDER="anthropic" \
#   AI_MODEL="claude-haiku-4-5-20251001" \
#   ANTHROPIC_API_KEY="your-anthropic-api-key"

# Hospital timezone (default already set in code, but you can override)
supabase secrets set --project-ref qfgvjyhnvmcczhqicend \
  APP_TIMEZONE="Asia/Kolkata"
```

**Verify secrets are set:**
```bash
supabase secrets list --project-ref qfgvjyhnvmcczhqicend
```

---

## STEP 4 — Deploy the Edge Function

```bash
# From your project root (ccdtfinal/)
supabase functions deploy daily-insights \
  --project-ref qfgvjyhnvmcczhqicend \
  --no-verify-jwt
```

`--no-verify-jwt` is required because the function uses its own `x-cron-secret` header instead of a JWT.

**Verify deployment:**
```bash
supabase functions list --project-ref qfgvjyhnvmcczhqicend
```

---

## STEP 5 — Schedule the Cron Job

First, store your CRON_SECRET in Supabase Vault so pg_cron can read it. In the **SQL Editor**, run (substituting your actual secret):

```sql
SELECT vault.create_secret('YOUR_CRON_SECRET_VALUE_HERE', 'cron_secret');
```

Then run the full `migration_v3_cron.sql` script. This schedules the job at **00:30 UTC = 06:00 AM IST** every day.

**Verify the schedule:**
```sql
SELECT jobid, jobname, schedule FROM cron.job WHERE jobname = 'meditrack-daily-insights';
```

---

## STEP 6 — Test Manually (before waiting for 6 AM)

**Dry run** (computes metrics, no DB writes, no LLM calls):

```bash
CRON_SECRET="your-secret-here"
curl -s -X POST \
  "https://qfgvjyhnvmcczhqicend.supabase.co/functions/v1/daily-insights" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d '{"dry_run": true}' | jq .
```

**Full run** (writes to ai_insights, calls LLM):
```bash
curl -s -X POST \
  "https://qfgvjyhnvmcczhqicend.supabase.co/functions/v1/daily-insights" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d '{"types": ["morning_brief", "forgotten_equipment", "rebalancing"]}' | jq .
```

**Trigger for a specific date** (useful for testing with the demo seed data):
```bash
curl -s -X POST \
  "https://qfgvjyhnvmcczhqicend.supabase.co/functions/v1/daily-insights" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d '{"date": "2025-01-15"}' | jq .
```

After a full run, verify the database:
```sql
SELECT id, insight_date, type, title, model, created_at
FROM ai_insights ORDER BY created_at DESC LIMIT 10;
```

---

## STEP 7 — View in the App

1. Open your MediTrack app (e.g. on Vercel) and log in as **Manager** or **Senior Doctor**.
2. The AI Daily Insights panel appears **above the stats bar** on the Dashboard.
3. Staff users do **not** see the panel.
4. Rebalancing card is **Manager-only**.

---

## Running Unit Tests (Deno)

```bash
deno test supabase/functions/daily-insights/metrics.test.ts --allow-env
```

---

## Local Development

1. Copy `.env.example` to `.env` inside `supabase/functions/daily-insights/` and fill in real values.
2. Start the local Supabase stack:
   ```bash
   supabase start
   ```
3. Serve the function locally:
   ```bash
   supabase functions serve daily-insights --env-file supabase/functions/daily-insights/.env
   ```
4. Call it locally:
   ```bash
   curl -X POST http://localhost:54321/functions/v1/daily-insights \
     -H "x-cron-secret: your-local-secret" \
     -H "Content-Type: application/json" \
     -d '{"dry_run": true}'
   ```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| 401 Unauthorized | Check `x-cron-secret` matches `CRON_SECRET` secret |
| "Data load failed" | Verify `SUPABASE_SERVICE_ROLE_KEY` is set and `ai_insights` table exists |
| model = "fallback" in output | AI API key is wrong or quota exceeded; insights still work (deterministic text) |
| Cards not showing in UI | Check browser console; ensure `migration_v3_ai_insights.sql` was run and anon SELECT policy exists |
| Cron never fires | Check `vault.decrypted_secrets` has 'cron_secret' row; check `cron.job_run_details` for errors |

---

## Security Notes

- No API keys are ever written to `index.html` or any client-side file.
- The `service_role` key is used only in the Edge Function environment.
- The cron authenticates via `x-cron-secret` (not a Supabase JWT) because the function is called by pg_net, not a browser.
- RLS on `ai_insights` allows SELECT for `anon` and `authenticated` but has no INSERT/UPDATE/DELETE policies, so the browser can never write to it.
- All AI-generated text is escaped with `esc()` or set via `textContent` before display.
