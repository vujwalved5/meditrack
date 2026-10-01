# MediTrack AI Daily Insights — Setup & Operations Guide

This document gives you the **exact commands and steps** to deploy the three AI daily insights features on your existing MediTrack project.

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

## STEP 1 — Database Migrations

Open the [Supabase SQL Editor](https://app.supabase.com/project/qfgvjyhnvmcczhqicend/editor) and run **all** scripts in order:

1. `migration_v3_ai_insights.sql` — creates the `ai_insights` table, RLS, index, realtime
2. `migration_v3b_run_log.sql` — creates the `ai_run_log` observability table (**new**)
3. (wait until step 5 to run `migration_v3_cron.sql`)

**After running step 1**, verify:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'ai_insights' ORDER BY ordinal_position;
```

**After running step 2**, verify:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'ai_run_log' ORDER BY ordinal_position;
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

# ── Primary AI provider — choose ONE ──

# Option A: Gemini (default)
supabase secrets set --project-ref qfgvjyhnvmcczhqicend \
  AI_PROVIDER="gemini" \
  AI_MODEL="gemini-2.5-flash" \
  GEMINI_API_KEY="your-gemini-api-key"

# Option B: Anthropic Claude
# supabase secrets set --project-ref qfgvjyhnvmcczhqicend \
#   AI_PROVIDER="anthropic" \
#   AI_MODEL="claude-haiku-4-5-20251001" \
#   ANTHROPIC_API_KEY="your-anthropic-api-key"

# ── Backup model (optional but strongly recommended) ──
# Defaults to same provider as primary with a lighter/cheaper model.
supabase secrets set --project-ref qfgvjyhnvmcczhqicend \
  AI_BACKUP_PROVIDER="gemini" \
  AI_BACKUP_MODEL="gemini-2.0-flash-lite"

# ── Timing overrides (all optional) ──
# supabase secrets set --project-ref qfgvjyhnvmcczhqicend \
#   LLM_TIMEOUT_MS="25000" \
#   LLM_TOTAL_BUDGET_MS="100000" \
#   LLM_GAP_MS="1500"

# Hospital timezone
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

**Dry run with payload inspection** (`show_prompts:true` returns the exact compact payload sent to the LLM):

```bash
curl -s -X POST \
  "https://qfgvjyhnvmcczhqicend.supabase.co/functions/v1/daily-insights" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d '{"dry_run": true, "show_prompts": true}' | jq .
```

**Full run** (writes to ai_insights, calls LLM):
```bash
curl -s -X POST \
  "https://qfgvjyhnvmcczhqicend.supabase.co/functions/v1/daily-insights" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d '{"types": ["morning_brief", "forgotten_equipment", "rebalancing"]}' | jq .
```

**Force re-run the same day** (bypass cache):
```bash
curl -s -X POST \
  "https://qfgvjyhnvmcczhqicend.supabase.co/functions/v1/daily-insights" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d '{"force": true}' | jq .
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
# Original metrics tests
deno test supabase/functions/daily-insights/metrics.test.ts --allow-env

# New compact payload tests
deno test supabase/functions/daily-insights/compact.test.ts --allow-env
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

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | *(required)* | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | *(required)* | Service-role key for the Edge Function |
| `CRON_SECRET` | *(required)* | Shared secret for `x-cron-secret` auth header |
| `AI_PROVIDER` | `gemini` | Primary AI provider: `gemini` or `anthropic` |
| `AI_MODEL` | `gemini-2.5-flash` | Primary model ID |
| `GEMINI_API_KEY` | — | Required when `AI_PROVIDER=gemini` |
| `ANTHROPIC_API_KEY` | — | Required when `AI_PROVIDER=anthropic` or backup is anthropic |
| `AI_BACKUP_PROVIDER` | same as `AI_PROVIDER` | Backup provider (cross-provider supported) |
| `AI_BACKUP_MODEL` | `gemini-2.0-flash-lite` | Backup model ID |
| `AI_FALLBACK_MODEL` | — | **Deprecated alias** for `AI_BACKUP_MODEL` (still works) |
| `LLM_TIMEOUT_MS` | `25000` | Per-attempt HTTP timeout (ms) |
| `LLM_TOTAL_BUDGET_MS` | `100000` | Total wall-clock budget across all 3 features (ms) |
| `LLM_GAP_MS` | `1500` | Gap between sequential LLM calls (ms) |
| `APP_TIMEZONE` | `Asia/Kolkata` | Hospital timezone (IANA) |

---

## Error Categories

Every LLM attempt is classified into exactly one `error_category`. These appear in `ai_run_log` and in `data.meta.attempts` of each `ai_insights` row.

| Category | Cause | Retry? |
|----------|-------|--------|
| `timeout` | HTTP request timed out (AbortController) | Yes (with backoff) |
| `rate_limited` | HTTP 429; respects `Retry-After` ≤ 20 s | Yes / skip to backup if > 20 s |
| `overloaded` | HTTP 500 / 502 / 503 / 504 | Yes (with backoff) |
| `auth_or_config` | HTTP 400 / 401 / 403 / 404 | **No** — skip straight to backup |
| `blocked_or_empty` | Safety block, empty candidates, finish reason not STOP | Yes |
| `truncated` | Gemini `MAX_TOKENS` or Anthropic `max_tokens` stop reason | Yes (retry with 1.5× tokens) |
| `bad_json` | Response not parseable as JSON | Yes |
| `schema_invalid` | Top-level structure missing (soft-coerce was not enough) | Yes |
| `network` | Fetch threw (DNS, connection refused, etc.) | Yes (with backoff) |

---

## Observability Queries

Run these in the [Supabase SQL Editor](https://app.supabase.com/project/qfgvjyhnvmcczhqicend/editor) using the **service role** (or your own SQL access):

### Failures by error_category over the last 14 days

```sql
SELECT
  error_category,
  COUNT(*) AS total_failures,
  COUNT(DISTINCT run_at::date) AS days_affected
FROM ai_run_log
WHERE
  outcome = 'failure'
  AND run_at >= NOW() - INTERVAL '14 days'
GROUP BY error_category
ORDER BY total_failures DESC;
```

### Average latency per model (last 14 days)

```sql
SELECT
  provider,
  model,
  COUNT(*) AS attempts,
  ROUND(AVG(latency_ms)) AS avg_latency_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)) AS p95_latency_ms
FROM ai_run_log
WHERE run_at >= NOW() - INTERVAL '14 days'
GROUP BY provider, model
ORDER BY avg_latency_ms;
```

### Daily success rate per feature

```sql
SELECT
  run_at::date AS day,
  type,
  COUNT(*) FILTER (WHERE outcome = 'success') AS successes,
  COUNT(*) FILTER (WHERE outcome = 'failure') AS failures,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE outcome = 'success') / COUNT(*), 1
  ) AS success_pct
FROM ai_run_log
WHERE run_at >= NOW() - INTERVAL '14 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
```

### Most recent run per feature

```sql
SELECT
  type,
  MAX(run_at) AS last_run,
  (ARRAY_AGG(outcome ORDER BY run_at DESC))[1] AS last_outcome,
  (ARRAY_AGG(model ORDER BY run_at DESC))[1] AS last_model,
  (ARRAY_AGG(error_category ORDER BY run_at DESC))[1] AS last_error_cat
FROM ai_run_log
GROUP BY type;
```

### Rate-limit events in the last 24 hours

```sql
SELECT run_at, type, model, latency_ms
FROM ai_run_log
WHERE error_category = 'rate_limited'
  AND run_at >= NOW() - INTERVAL '24 hours'
ORDER BY run_at DESC;
```

### auth_or_config errors (investigate immediately)

```sql
SELECT run_at, type, provider, model, http_status, error_category
FROM ai_run_log
WHERE error_category = 'auth_or_config'
ORDER BY run_at DESC
LIMIT 20;
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| 401 Unauthorized | Check `x-cron-secret` matches `CRON_SECRET` secret |
| "Data load failed" | Verify `SUPABASE_SERVICE_ROLE_KEY` is set and `ai_insights` table exists |
| `model = "fallback"` in output | All LLM attempts failed; insights still work (deterministic text). Check `ai_run_log` for `error_category`. |
| `model = "none"` | No items to process (e.g. no forgotten equipment). Normal. |
| Cards not showing in UI | Check browser console; ensure `migration_v3_ai_insights.sql` was run and anon SELECT policy exists |
| Cron never fires | Check `vault.decrypted_secrets` has 'cron_secret' row; check `cron.job_run_details` for errors |
| Same-day re-run makes 0 LLM calls | This is expected (cache hit on same payload). Use `"force": true` to bypass. |
| `auth_or_config` in run_log | Wrong API key or model name. Backup runs immediately. Fix the key and redeploy secrets. |

---

## Security Notes

- No API keys are ever written to `index.html` or any client-side file.
- The `service_role` key is used only in the Edge Function environment.
- The cron authenticates via `x-cron-secret` (not a Supabase JWT) because the function is called by pg_net, not a browser.
- RLS on `ai_insights` allows SELECT for `anon` and `authenticated` but has no INSERT/UPDATE/DELETE policies, so the browser can never write to it.
- `ai_run_log` has RLS enabled with **no policies** — only the service role can access it (no browser access).
- All AI-generated text is escaped with `esc()` or set via `textContent` before display.
- Free-text fields (equipment names, usernames, department names) are sanitised via `cleanText()` before being sent to the LLM, neutralising prompt injection surface.

---

## Architecture Notes

### Payload compaction (compact.ts)

Full facts are always stored in `data.metrics` (read by the UI). The LLM only sees a compact view:
- Minified JSON, no nulls, no ISO timestamps, no internal IDs
- Durations pre-formatted as `"19h 5m"`, percentages as integers
- Free-text truncated to 40 chars and sanitised
- At most 8 forgotten items (short f-ids map back to equipment_ids in code)
- At most 3 rebalancing candidates (4th/5th get deterministic rationale)

### Call orchestration

1. All DB fact-computation runs in parallel
2. LLM calls run **sequentially** in order: `morning_brief` → `forgotten_equipment` → `rebalancing`
3. Gap of `LLM_GAP_MS` (default 1.5 s) between calls to avoid per-minute rate-limit bursts
4. Per feature: primary attempt 1 → (retryable) primary attempt 2 → backup → deterministic fallback
5. Total budget is tracked across all features; if remaining budget < one timeout, skip to fallback

### Caching

On a same-day re-run, if `data.meta.input_hash` (SHA-256 of `PROMPT_VERSION + compact_payload`) matches and the row's model is not `"fallback"`, the LLM call is skipped. Use `"force": true` in the request body to bypass.
