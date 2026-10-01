# MediTrack - Hospital Equipment Tracking System

A real-time hospital equipment visibility prototype with QR-based status updates,
user authentication, and role-based access control.

## Default Login Credentials

  Username:  admin
  Password:  NewAdmin@123!

IMPORTANT: Change this password after your first login via Manage Users > Reset PW.

## Quick Start

1. Open index.html in Chrome or Edge (no build step required).
2. Log in with the credentials above.
3. For mobile / QR scanning on a phone, serve locally over your network:

   python -m http.server 8080

   Then open http://YOUR-PC-IP:8080 on your phone browser.
   (Run ipconfig in PowerShell to find your local IP address.)

## How Roles Work

Three roles exist. Each sees only the features appropriate to their access level.

  Manager
    - Full access to the Equipment Dashboard
    - Can add new equipment / products and auto-generate QR codes
    - Can print / download physical QR code sticker labels (PNG & Print layout)
    - Can scan QR codes and toggle equipment status
    - Can submit equipment requests
    - Can Approve or Reject pending requests
    - Access to the Manage Users page (only this role can see it):
        - Create new user accounts with a temporary password
        - Reset any other user's password
        - Deactivate or Reactivate accounts (soft delete - preserves history)

  Senior Doctor
    - Full access to the Equipment Dashboard
    - Can scan QR codes and toggle equipment status
    - Can submit equipment requests
    - Can Approve or Reject pending requests (the Approve/Reject buttons render only for this role and Manager)
    - Cannot see the Manage Users page

  Staff
    - Full access to the Equipment Dashboard
    - Can scan QR codes and toggle equipment status
    - Can submit equipment requests
    - Cannot see Approve/Reject buttons (a status message is shown instead)
    - Cannot see the Manage Users page

## Creating Users (First-Time Setup)

1. Log in as admin (Manager role)
2. Click the "Manage Users" tab in the header
3. Fill in the Create New User form: username, role, department
4. A randomly generated temporary password is displayed once - share it securely
5. The new user logs in with that password and can have it reset by a Manager

## Demo Flow

### Live Dashboard
- Open two browser windows to the same index.html (log in both)
- One window acts as the scanning device, the other as the live monitor

### QR Scan + Status Toggle
1. Click Scan QR on Window 1 and allow camera access
2. Point camera at any QR code visible on Window 2
3. Window 2 updates live (green to red) without refreshing

### Conflict Prevention
1. Mark a piece of equipment In Use
2. Scan the same QR code again
3. A red CONFLICT ALERT appears -- status is not changed

### Request Flow (role-gated)
1. On In Use equipment, click Request
2. Toggle to Urgent priority and submit
3. Pending Requests panel shows the request
4. Urgent requests display an orange "Needs Sr. Doctor / Manager" badge
5. Log in as Senior Doctor or Manager to see Approve/Reject buttons
6. Staff sees a "Awaiting approval" message instead

### Release and Audit Log
1. Click Release on any In Use item (or re-scan its QR)
2. Status returns to Available on all windows
3. Audit Log panel shows every timestamped action with the real logged-in username

## Password Hashing: Tradeoff Note

Passwords are hashed using bcryptjs (cost factor 10) in the browser before being
stored in the database. This means no plaintext passwords are ever stored or transmitted.

TRADEOFF: Client-side hashing is acceptable for a college prototype demo, but in a
production system this creates a risk: a malicious actor who has the database hash
could theoretically perform offline brute-force attacks without hitting the server.

FUTURE WORK: Move password hashing (and login comparison) to a Supabase Edge Function
so that:
  - Raw passwords never leave the client as anything but HTTPS-encrypted traffic
  - All bcrypt computation happens server-side
  - Rate limiting can be enforced server-side to prevent brute-force attacks
  - Supabase Auth (JWT tokens) can replace the localStorage approach

## Database Schema

Tables:
  departments   - ICU, General Ward, Emergency
  equipment     - Items tracking with condition, held_by, in_use_since
  requests      - equipment requests with Normal/Urgent priority, requested_by (text)
  audit_log     - full history of all status changes (records real logged-in username)
  users         - accounts with bcrypt-hashed passwords and role assignments, is_active flag

SQL Files:
  schema.sql        - complete master schema (tables, seed data, Realtime, RLS, auth & RPC)

## Supabase Configuration

Project URL: https://qfgvjyhnvmcczhqicend.supabase.co
Anon Key: embedded in index.html (safe for public demos)
Realtime: enabled on equipment, requests, and audit_log tables
RLS: configured for anonymous access (demo mode)

## Tech Stack

  Frontend:       Vanilla HTML5, CSS3, JavaScript (no framework, no build step)
  Backend/DB:     Supabase (Postgres + REST + Realtime)
  Authentication: Client-side bcryptjs (CDN) + localStorage session + secure login RPC
  QR Generation:  qrcodejs (CDN)
  QR Scanning:    html5-qrcode (CDN)
  Fonts:          Inter (Google Fonts)

## Files

  index.html         Complete single-page application (auth + RBAC + all equipment features)
  schema.sql         Complete master schema (tables, seed data, Realtime, RLS, auth & RPC)
  README.md          This file

## v2 — Features

### Expandable Equipment List
The dashboard now shows equipment in an accordion list instead of a card grid.

- Every row is a clickable button (keyboard-accessible with Enter/Space).
- Clicking a row expands it to show: Location, Status (with live duration counter
  when In Use), Used by, Condition badge, QR code (96px), and the action area.
- Only ONE row can be open at a time. Opening another closes the previous.
- Search box filters by name, department, or QR ID in real-time.
- Department chips and Available/In Use/All status filters all work together.
- When Supabase pushes a live equipment update, the affected row refreshes WITHOUT
  collapsing the currently open row or scrolling the page.

### Request Access Rules
- The "Request Access" button is shown ONLY for Staff and Senior Doctor.
  Managers cannot see or use it.
- The button is disabled (with helper text) if:
    - The logged-in user is already holding the item (held_by === username)
    - The item condition is "Out of Order"
- submitRequest() returns early with an error toast if called by a Manager,
  so the rule cannot be bypassed from the browser console.

### Condition Tracking (Manager only)
- Each equipment row in the expanded view shows a Condition badge:
    Usable (green), Needs Maintenance (amber), Out of Order (gray).
- Managers see a Condition dropdown + Save button to update it.
- Every change is logged in audit_log with action "Condition Changed".

### Audit Log Page
- Accessible via the "Audit Log" nav tab for Manager and Senior Doctor.
  Staff cannot see the tab. Navigating directly (e.g. via console) redirects
  to the Dashboard.
- One accordion row per piece of equipment (all equipment listed, even with
  zero history — shows "No usage yet").
- Collapsed row shows: name, department, total "Checked Out" count, last activity
  summary (relative time + user), and current status pill.
- Expanded row shows a vertical timeline (newest first) with:
    - Colored dot by action (Checked Out=red, Released=green, Request Submitted=amber,
      Approved=green, Rejected=gray, Condition Changed=blue)
    - Action label, username, formatted timestamp
    - For Released entries: "used for Xh Ym" calculated from the preceding Checked Out
    - For Checked Out with no matching Released: "still in use"
- Timeline loads lazily (limit 20) when the row is expanded, with a "Load more" button.
- Filters: text search (name or user), department, date range, action type.
- Export CSV: downloads currently filtered data as a CSV file.
- Realtime: new audit_log inserts prepend to the open row's timeline immediately.

### Navigation (final state)
  Staff:          Dashboard
  Senior Doctor:  Dashboard, Audit Log
  Manager:        Dashboard, Audit Log, Manage Users

### Database Schema Details
All columns and configurations are included in `schema.sql`.

Columns on the equipment table:
  condition     TEXT DEFAULT 'Usable'   -- 'Usable' | 'Needs Maintenance' | 'Out of Order'
  held_by       TEXT                    -- username of the current user; null when free
  in_use_since  TIMESTAMPTZ             -- when checked out; null when free (with timezone)

audit_log actions now use these exact strings for reliable grouping:
  'Checked Out', 'Released', 'Request Submitted', 'Request Approved',
  'Request Rejected', 'Condition Changed'

Realtime is also enabled on the audit_log table (in addition to equipment and requests).

## Out of Scope

The following features are intentionally not implemented:
  - Server-side authentication / JWT / Supabase Auth
  - Push notifications
  - Booking time slots
  - Maintenance scheduling
  - Human-resource conflict handling

---

## v3 — Product Tiles

### ⚠️ Migration Required
Before using this version, run `migration_v3.sql` in the **Supabase SQL Editor**:
  1. Open https://app.supabase.com and select your project
  2. Go to SQL Editor > New Query
  3. Paste the contents of migration_v3.sql and click Run
  4. Confirm the verification SELECT at the bottom shows 8 rows with product types

### New Database Table: product_types

  product_types
    id          SERIAL PRIMARY KEY
    name        TEXT UNIQUE NOT NULL       -- e.g. "Ventilator"
    image_url   TEXT                       -- e.g. "images/ventilator.png"
    created_at  TIMESTAMP DEFAULT NOW()

### New Column on equipment

  product_type_id  INTEGER REFERENCES product_types(id)  -- nullable

### How Product Tiles Work

1. On login, loadProductTypes() fetches all rows from product_types.
2. A tile grid appears above the search bar on the Dashboard.
3. The first tile is "All Equipment" (default selected).
4. Each subsequent tile shows:
   - The product image (falls back to an emoji if missing or broken)
   - The product name
   - Live count: "N items · N available"
   - A green dot (≥1 available) or red dot (none available)
5. Clicking a tile sets a product type filter that combines with the
   existing search box, department chips, and status filters.
6. Clicking the selected tile again resets the filter to "All".
7. A breadcrumb bar appears when a tile is selected, showing
   "All Equipment › Ventilators" plus the current filtered count,
   and a "← Back to all" button.
8. A ▲/▼ collapse button above the grid lets users hide the tiles
   to a slim horizontal scrollable strip and restore them.
9. Tile counts and dots update live via Realtime when equipment
   status changes in another browser window.

### Seeded Product Types

  Ventilator      → images/ventilator.png
  Wheelchair      → images/wheelchair.png
  Infusion Pump   → images/infusion-pump.png
  Defibrillator   → images/defibrillator.png
  Portable Monitor→ images/portable-monitor.png

### Image Files to Supply

Place the following square PNG files (400×400px, white/light background) in the
images/ folder next to index.html:

  images/ventilator.png
  images/wheelchair.png
  images/infusion-pump.png
  images/defibrillator.png
  images/portable-monitor.png

The images/ folder contains a README.md with detailed requirements.
If any file is missing, the tile shows an emoji fallback and still works.

### Manager: Add Product Type Inline

  - The Add Product modal now has a "Product Type" dropdown.
  - Choosing "+ New product type..." reveals a text field (name) and
    an optional image path/URL field.
  - Creating a new type inserts into product_types first, then uses
    the returned id as product_type_id on the new equipment row.
  - The new type appears immediately in the tile grid without a page reload.
  - Only Managers see this control (same gate as the Add Product button).

### SQL Files

  schema.sql        - Complete master schema (v2 features included)
  migration_v3.sql  - v3 incremental migration (product types, tile data)

---

## v4 — AI Daily Insights

Three AI-generated daily insights appear in a panel at the top of the Dashboard for Manager and Senior Doctor roles. Staff do not see the panel.

### Deployment Required
See **README_AI.md** for full setup steps. Summary:
1. Run `migration_v3_ai_insights.sql` in Supabase SQL Editor
2. Run `seed_demo_history.sql` for demo data (optional)
3. Set secrets: `supabase secrets set ...` (see README_AI.md for exact commands)
4. Deploy: `supabase functions deploy daily-insights --no-verify-jwt`
5. Run `migration_v3_cron.sql` to schedule the 06:00 AM IST daily job
6. Test with `curl` (see README_AI.md)

### Features

**Morning Ops Brief** (Manager + Senior Doctor)
- Yesterday's checkout count vs 7-day baseline
- Overnight items (held past midnight)
- Equipment not in a Usable condition
- Pending / urgent requests summary
- AI-written headline, summary, and attention chips

**Forgotten Equipment Detector** (Manager + Senior Doctor)
- Flags items held longer than N× their type-specific median hold time
- Severity: warning (≥3× median) or critical (≥6× median)
- Falls back to an 8h default threshold when fewer than 5 sessions exist
- AI provides a one-sentence message + suggested action per item

**Department Rebalancing Recommender** (Manager only)
- Compares utilization and demand requests across departments for the same equipment type
- Identifies a specific unit to move from a low-demand department to a high-demand one
- AI writes the rationale citing exact numbers; code selects the candidate

### Design Principles
- CODE computes all numbers, flags, severities, and candidates (deterministic + testable)
- LLM only writes human-readable wording from those facts
- No AI API key on the client side
- Fallback: if the LLM fails, rule-based text is generated deterministically
- Re-running the same day overwrites (delete + insert) — no duplicates
- All AI text is escaped with `esc()` before display

### New Files
  migration_v3_ai_insights.sql  - ai_insights table, RLS, realtime
  migration_v3_cron.sql         - pg_cron + pg_net scheduler
  seed_demo_history.sql         - 14-day demo audit history + forgotten equipment scenario
  README_AI.md                  - Deployment guide with exact CLI commands

  supabase/functions/daily-insights/
    index.ts      - Edge Function entry point
    config.ts     - Threshold constants
    time.ts       - Timezone helpers (parseUtc, localDayBounds, etc.)
    data.ts       - Paginated data loader and session builder
    metrics.ts    - Deterministic fact computation for all 3 features
    llm.ts        - Gemini / Anthropic abstraction, retry, fallback
    prompts.ts    - System prompt, per-feature prompts, validators
    metrics.test.ts - Deno unit tests
    .env.example  - Environment variable template

### New Database Table

  ai_insights
    id            BIGSERIAL PRIMARY KEY
    insight_date  DATE NOT NULL
    type          TEXT -- 'morning_brief' | 'forgotten_equipment' | 'rebalancing'
    department_id INTEGER REFERENCES departments(id) NULL
    title         TEXT
    summary       TEXT
    data          JSONB  -- metrics + AI output
    model         TEXT   -- AI model name or 'fallback'
    created_at    TIMESTAMPTZ

### Weekly Deep Analysis
A new **Weekly Deep Analysis** feature allows Managers to trigger a comprehensive 7-day review on demand.
See **README_AI.md** for setup instructions, architecture details, and how to test the background job orchestration.

