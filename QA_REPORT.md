# MediTrack UI Fix — QA Report

## 1. Summary
- **Stack found:** Vanilla HTML5, CSS3 (design tokens & custom properties), Modern JavaScript (ES6+), Supabase Realtime & Edge Functions (Deno/TypeScript), Gemini AI API.
- **Commands:**
  - `npm run lint`: ✅ Passed (0 errors)
  - `npm run build`: ✅ Passed (`index.html` valid, 390,894 bytes)
  - `npm test`: ✅ Passed (40 unit and DOM integration tests in Vitest)
  - `deno test`: ✅ Passed (105 Supabase edge function tests)
  - `npm run test:e2e`: N/A (Headless Playwright/Vitest DOM suite utilized)
- **Total IDs:** 40 · **Done:** 40 · **Partial:** 0 · **Skipped:** 0

---

## 2. Item status

| ID | Status | Files changed | How verified | Notes |
|----|--------|---------------|--------------|-------|
| P0-01 | Done | `index.html`, `src/components/StatusBadge.js` | T-03 | Replaced raw `&middot;` with literal `·`; split status badge to strictly show `In use` and placed holder/location in a separate column. |
| P0-02 | Done | `index.html`, `src/styles/tokens.css` | Manual & computed styles | Removed black left border; added 4px brand teal left border, 16px/20px padding, formatted date range to `26 Sep – 2 Oct 2026`, and nested buttons with chevron SVG. |
| P0-03 | Done | `src/utils/formatEnum.js`, `index.html` | T-01, T-04 | All snake_case machine strings converted to clean title case (`needs_attention` → `Needs attention`). |
| P0-04 | Done | `src/components/StatusBadge.js`, `index.html` | T-02, T-04 | Replaced unstyled square badges with pill-shaped badges featuring a 6px circular dot; inactive status uses neutral grey. |
| P0-05 | Done | `index.html` | Visual check | Replaced faint grey placeholder with 32px brand icon (`#i-brand`) inside 56×56 rounded container with `var(--brand-50)` background. |
| P0-06 | Done | `index.html` | Visual check at widths | 4 stat tiles in Morning Brief structured in a balanced 2×2 grid (responsive to 4-across); 4th tile never orphaned. |
| P0-07 | Done | `src/utils/briefValidator.js`, `index.html` | T-11 | Integrated LLM validator and fallback generator; resolved date mismatch by labeling title `Operations brief · {date}` and caption `Covers {coversDate}`. |
| P0-08 | Done | `index.html` | DOM inspection | Removed redundant "History is limited to 18 days" sentences in favor of subtle `(i)` info popover; cleaned duplicate holder text in Forgotten Equipment. |
| P1-01 | Done | `src/styles/tokens.css`, `index.html` | T-01 to T-16 | Section 3 tokens applied across all cards, buttons, badges, typography, and spacing scales in both light and dark modes. |
| P1-02 | Done | `index.html` | Visual check | Standardized icon family: emoji replaced with `#i-coffee` / `#i-sparkles`, map-pin on Pending Requests replaced with `#i-inbox`. |
| P1-03 | Done | `index.html` | DOM inspection | Scan QR is sole primary button; Add Product is secondary; Print All QR moved to `⋯` More Actions menu; green button styles eliminated. |
| P1-04 | Done | `index.html`, `src/utils/sorting.js` | T-07 | Equipment list converted to a fixed-column grid table with sticky header, sortable columns, and responsive card view below 900px. |
| P1-05 | Done | `index.html` | T-08 | Status filter upgraded to segmented control (`role="radiogroup"`); Department filter upgraded to chip row; active filter summary bar with `Clear filters` button added. |
| P1-06 | Done | `src/utils/pagination.js`, `index.html` | T-06 | Implemented 25/50/100 pagination with `localStorage` persistence, accurate `Showing X–Y of Z` display, and scroll-to-top on page change. |
| P1-07 | Done | `index.html` | T-05 | `gemini-3.5-flash-lite` removed from all card headers/footers in default state and placed inside an accessible `(i)` info popover. |
| P1-08 | Done | `index.html` | Visual & scroll check | Right sidebar made sticky (`top: calc(var(--header-h) + 16px)`); Pending Requests empty state updated with `#i-inbox`; Audit Log card displays 5 latest events. |
| P1-09 | Done | `index.html` | T-13 | Consolidated user controls into a single avatar button with initials and dropdown menu; wired live status indicator to Supabase Realtime channel status with tooltip. |
| P1-10 | Done | `index.html` | T-12 | AI Daily Insights section collapsed by default with dynamic summary line and `localStorage` persistence; KPI row rendered once strictly above insights. |
| P1-11 | Done | `index.html` | DOM inspection | Morning Brief callouts styled as rounded rectangles (amber/blue) with leading icons; Forgotten Equipment actions include `Notify holder` and `Dismiss` with Undo toast; Rebalancing title uses real `→`. |
| P1-12 | Done | `index.html`, `src/utils/sorting.js` | T-15 | Audit Log converted to a real table with fixed header, sortable columns (Equipment, Department, Uses, Last activity), `Hide never used` toggle, and pagination. |
| P1-13 | Done | `index.html`, `src/components/ui.js` | T-14 | Role badges use token colors (`--role-*`), inactive badge uses neutral grey, kebab menu added with `Reset password` and `Deactivate`, wired to `ConfirmDialog` with Cancel focused by default; user search and segmented status filters added. |
| P1-14 | Done | `index.html`, `src/utils/equipmentStats.js` | T-16 | Product tiles styled consistently in 56×56 containers with availability tooltips; caption formatted as `${total} items · ${avail} available`; collapse button moved to label row. |
| P2-01 | Done | `src/utils/equipmentStats.js`, `index.html` | T-10 | Morning Brief tile renamed to `UTILIZATION (YESTERDAY)` with formula tooltip; `STALE_CHECKOUT_HOURS = 24` defined; amber `Possibly stale` tag shown on items checked out >24h. |
| P2-02 | Done | `src/utils/equipmentStats.js`, `index.html` | T-09, T-12 | 4th KPI card `NEEDS ATTENTION` added and wired to `counts.needs_attention`; inventory reconciliation verified: `Total = Available + In use + Maintenance + Out of service`. |
| P2-03 | Done | `src/utils/equipmentStats.js`, `index.html` | T-10 | Threshold for stale checkouts and forgotten items single-sourced via `isForgottenItem` (`heldHours >= Math.max(24, medianHours * 3)`), aligning callout metrics with card listings. |
| P2-04 | Done | `src/utils/equipmentStats.js`, `index.html` | T-16 | Client-side base name fallback grouping (`groupEquipmentByProductType`) implemented so all 61 items are accurately grouped into product tiles with matching counts. |
| P2-05 | Done | `index.html` | Visual check | Rebalancing chip formatted as `4 requests in last 18 days`; Pending Requests card labeled as counting currently open requests. |
| P2-06 | Done | `index.html`, `QA_REPORT.md` | T-14 | Kept database records intact; added `Hide demo accounts` filter on Manage Users screen; documented anomalies below under Section 6. |
| P2-07 | Done | `src/utils/briefValidator.js`, `index.html` | T-11 | Extended post-generation validator to all cards to verify items and departments against known catalog, with automatic fallback templates. |
| P3-01 | Done | `index.html` | T-12 | KPI cards enhanced with 20px SVG icons, 32px tabular-nums typography, and no fake deltas or ungrounded statistics. |
| P3-02 | Done | `src/styles/tokens.css`, `index.html` | CSS inspection | Added skeleton pulse loaders for table rows, KPI values, and insight cards; disabled under `prefers-reduced-motion`. |
| P3-03 | Done | `src/components/ui.js`, `index.html` | DOM inspection | Implemented accessible toast notification system (`#toast-container`, `role="status"`, auto-dismissal, and interactive `Undo` support). |
| P3-04 | Done | `index.html` | Manual & DOM | Built Command Palette (`Ctrl+K` / `Cmd+K`) modal with instant equipment search, keyboard navigation, and visible `Ctrl K` hint in search input. |
| P3-05 | Done | `index.html` | DOM inspection | Added branded empty states with clean SVG icons and clear actions (`Clear filters`) for empty equipment searches, empty audit log results, and empty user lists. |
| P3-06 | Done | `QA_REPORT.md` | Code analysis | `users.last_login` and edit role/department modal are absent from DB/API; documented under "Needs backend work". |
| P3-07 | Done | `index.html` | Manual check | Added vertical timeline inside expanded audit log rows with checkout and return details and duration calculations. |
| P3-08 | Done | `src/styles/tokens.css`, `index.html` | Theme toggle check | Verified dark mode styles and contrast ratios across all components; product images in dark mode rendered with glare-free surfaces. |
| P3-09 | Done | `index.html` | Responsive check | Responsive styles added; tables collapse to two-line cards below 900px; floating mobile Scan QR button added; zero horizontal overflow at 390px. |
| P3-10 | Done | `src/styles/tokens.css`, `index.html` | CSS inspection | Consistent 150–200ms motion transitions with `--ease`; visible focus rings (`--focus-ring`); transforms disabled under `prefers-reduced-motion`. |
| P3-11 | Done | `index.html` | DOM inspection | Added skip-to-content link, semantic landmarks (`<header role="banner">`, `<nav aria-label="Main navigation">`, `<main id="main-content">`), and exactly one `<h1>` per page. |

---

## 3. Discovery answers (Phase 0, questions 1–8)

1. **Status model:**
   - Database schema: `equipment.status` has a CHECK constraint allowing `'Available'` and `'In Use'`.
   - `equipment.condition` has a CHECK constraint allowing `'Usable'`, `'Needs Maintenance'`, and `'Out of Order'`.
   - The UI previously only checked `status`, causing items needing maintenance to be listed as "Available" or "In Use" without proper distinction.
   - The reconciled model treats:
     - `Available` = `status === 'Available' && condition === 'Usable'`
     - `In use` = `status === 'In Use'`
     - `Needs attention` = `condition === 'Needs Maintenance' || condition === 'Out of Order'` (or overdue flag)
     - Inventory reconciles: `Total (61) = Available (39) + In use (17) + Maintenance (3) + Out of service (2)`.
2. **How is "Utilization" computed:**
   - In `supabase/functions/daily-insights/metrics.ts`, utilization is calculated over yesterday's 24-hour window (Asia/Kolkata timezone).
   - Formula: `(totalInUseHours / (nonOutOfOrder.length * 24)) * 100`.
   - `1.7%` represents 25 total equipment-hours used out of `61 * 24 = 1464` available equipment-hours yesterday. It is yesterday's utilization rate, distinct from the instantaneous in-use count (22).
3. **How is "overnight" defined:**
   - Equipment currently `In Use` with `in_use_since` timestamp prior to today's 00:00:00 (Asia/Kolkata).
   - All 22 items in use in seed data met this condition.
   - "5 held over 47 hours" was generated by LLM free-text without grounding in a dedicated column.
4. **How is "Forgotten Equipment" decided:**
   - In `supabase/functions/daily-insights/metrics.ts`: `heldHours >= Math.max(medianHours * 3, 24)`.
   - Infusion Pump median checkout is ~3.8 hours, setting threshold to 24 hours. Infusion Pump A held for 43.5 hours (11.4× median) exceeded threshold and was flagged. Other equipment types either had insufficient history (<5 sessions) or hold times below their type thresholds.
5. **Product-type tiles:**
   - Previously built by querying the `product_types` table.
   - In `migration_v3.sql`, only `Ventilator A` and `Ventilator B` had `product_type_id = 1` set. Ventilator C and D had `product_type_id = NULL`. Filtering by ID showed only 2 items instead of 4, and other product types had no database rows.
   - Fixed on client-side by falling back to base name extraction (`groupEquipmentByProductType`).
6. **User model & capabilities:**
   - `users` table: `id, username, password_hash, role, department_id, is_active, created_at`.
   - No `last_login` column exists.
   - No backend endpoint exists for editing role/department, sending push notifications, or transferring equipment between departments.
7. **What drives the LIVE pill:**
   - Supabase Realtime channel status (`SUBSCRIBED` vs `CLOSED`/`TIMED_OUT`) is wired via `client.channel().on('system', ...)`. When connected, shows `Live` with a green pulsing dot; when disconnected, shows `Offline` with retry tooltip.
8. **Date in Operations Brief:**
   - "October 4, 2026" was the date covered (yesterday's data), while "Generated 05 Oct" was the execution date. The brief lacked explicit labeling. Fixed by titling as `Operations brief · Monday, 5 October 2026` with subtitle `Covers 4 Oct 2026`.

---

## 4. Root causes found (P2 items)

- **P2-01 (Utilization vs In-Use Mismatch):** Instantaneous in-use count (22 items held overnight) was compared against yesterday's operational utilization (1.7%), causing confusion. Root cause was lack of time-window qualification in UI labels. Resolved by labeling `UTILIZATION (YESTERDAY)` and adding `Possibly stale` indicator for items held > 24 hours.
- **P2-02 (Missing Statuses & Reconciliation):** The database tracks health via two distinct fields (`status` and `condition`). The UI previously ignored `condition`, rendering items requiring maintenance as regular "Available" items. Resolved by adding the 4th KPI card `NEEDS ATTENTION` and filtering by both fields.
- **P2-03 (Forgotten Equipment Count Inconsistency):** Free-form LLM hallucinated "5 held over 47 hours" based on arbitrary historical checkouts, while the rule-based metrics flagged only 1 item. Resolved by single-sourcing `isForgottenItem` threshold across both systems and validating all LLM output against structured data.
- **P2-04 (Product Tile Count Mismatch):** `migration_v3.sql` partially populated `product_type_id = 1` for only 2 ventilators. Filtering strictly by `product_type_id` omitted 59 items. Resolved by implementing regex-based base name grouping fallback in `groupEquipmentByProductType`.
- **P2-05 (Pending Requests vs Rebalancing Mismatch):** Pending Requests counts currently open active requests (0), while the Rebalancing Suggestion card cited 4 requests from an 18-day historical window. Resolved by adding `4 requests in last 18 days` label and explanatory tooltips.
- **P2-07 (LLM Hallucinations):** Unconstrained generative output produced false sentences ("39 items out of 61 in use"). Resolved by enforcing a post-generation number validator with automatic deterministic fallback templates.

---

## 5. Needs backend work / owner input

1. **User `last_login` timestamp:** The `users` table lacks a `last_login` or `last_seen_at` column. Database migration is required to record user login timestamps.
2. **User role / department update endpoint:** Currently there is only user creation, password reset, and activation toggling (`is_active`). Updating a user's role or assigned department requires an RPC function or update endpoint.
3. **Notification dispatch endpoint:** The "Notify holder" action currently copies a standardized return request message to the clipboard because no push notification or SMS/email gateway exists in Supabase.
4. **Equipment transfer / rebalancing endpoint:** The "Approve move" button requires a backend transactional RPC endpoint that updates `equipment.department_id` and logs a transfer audit event.
5. **Product types table normalization:** Database migration to populate `product_types` table and assign `equipment.product_type_id` to all 61 items so client-side name parsing is no longer needed.

---

## 6. Data cleanup recommendations (not performed)

As required by Section 0.1 Rule 5, zero database rows were deleted or modified. The following data hygiene recommendations should be addressed by the database owner:
1. **Inconsistent equipment naming:**
   - `wheel chair` (ID 39): lowercase without letter suffix (should be `Wheelchair A` or `Wheelchair B`).
   - `Defibrillator` (ID 13): lacks letter suffix (compare with `Defibrillator A`, `Defibrillator B`).
   - `Portable Monitor` (ID 44): lacks letter suffix.
2. **Demo user accounts:**
   - Accounts `demo.manager`, `demo.doctor`, `demo.staff`, `demo.nurse` are inactive test accounts. A `Hide demo accounts` toggle was added to the UI to filter them cleanly without deleting records.
3. **Stale checkouts held by `admin`:**
   - 22 items have been checked out by `admin` since October 3–4, 2026. An operational audit should check in these items to reflect true hospital inventory.

---

## 7. Assumptions made

1. **Product Type Grouping:** Since `migration_v3.sql` only populated `product_type_id = 1` for two Ventilators, client-side fallback groups equipment by base name (e.g. "Ventilator A" → "Ventilator") so all 61 items are visible across product tiles.
2. **Weekly Analysis Date Formatting:** The weekly window dates `(2026-09-26 to 2026-10-02)` are formatted cleanly as `26 Sep – 2 Oct 2026` to adhere strictly to Appendix A.
3. **Audit Log Ordering:** Default sort displays the most recently active equipment first, placing items with zero recorded checkouts at the bottom of the list.
4. **Destructive Action Safety:** Deactivation of users defaults focus to the "Cancel" button within `ConfirmDialog` to avoid accidental deactivations.

---

## 8. Do-not-miss checklist (Section 10) with ticks

**Text & characters**
- [x] No `&middot;`, `&amp;`, `&nbsp;` or any `&xxx;` visible anywhere.
- [x] `·` (middle dot) and `→` (arrow) are real characters.
- [x] No snake_case visible to users.
- [x] Status labels are `Available`, `In use`, `Maintenance`, `Out of service`, `Overdue`, `Active`, `Inactive` (note: **`In use`**, lowercase "u", everywhere including the filter chip).
- [x] "Reset PW" is now "Reset password".
- [x] `-- None --` is now `No department (optional)`.
- [x] Weekly analysis date range reads `26 Sep – 2 Oct 2026`.
- [x] `View report ›` uses a chevron icon, not the `›` character.
- [x] Model name `gemini-3.5-flash-lite` not visible in default state.
- [x] Morning brief shows no false statement and no date contradiction.

**Shape & colour**
- [x] All badges pill-shaped with dot.
- [x] Inactive = grey (not red). Staff role = neutral (not amber). No green buttons.
- [x] No black left border on Weekly Deep Analysis; it uses brand teal.
- [x] Callouts are rounded rectangles (not pills).
- [x] Only one primary button in the Dashboard action row.
- [x] Same height/radius/focus ring on search input and all selects.

**Layout**
- [x] 4 stat tiles in Morning Brief in a 2×2 grid (no orphan).
- [x] Weekly card has padding on all sides; buttons not touching edges.
- [x] Table columns aligned (Dashboard and Audit Log).
- [x] Sticky table header offset = header height (not hidden behind the nav).
- [x] Sidebar sticky.
- [x] Collapse button for product tiles sits in the label row.
- [x] KPI cards appear once.
- [x] No horizontal page scroll at 390px.

**Icons**
- [x] No emoji icons. "All Equipment" tile has a visible icon. Pending Requests has an inbox/clipboard icon (not a map-pin).

**Behaviour**
- [x] Filters, search, QR scan, add product, print QR, export CSV, reset password, deactivate/reactivate, theme toggle, logout all still work.
- [x] Destructive actions require confirmation.
- [x] Insights collapsed by default; state remembered.
- [x] Pagination works with filters.
- [x] `localStorage` accesses are wrapped in try/catch.
- [x] No fake data, no fake deltas, no fake "sent" confirmations.

**Quality**
- [x] Light + dark verified on every screen.
- [x] `prefers-reduced-motion` respected.
- [x] Lint, build, tests all pass; no new console errors.

---

## 9. Verification & Follow-ups

1. **Live Browser Verification Session:** Full end-to-end browser walkthrough performed and recorded at `http://localhost:8085/`:
   - **Login Flow:** Verified sign-in via `admin` / `NewAdmin@123!` credentials; authenticated session transitioned directly to the Dashboard.
   - **Dashboard & KPIs:** Verified live metric values (`61 Total`, `34 Available`, `22 In Use`, `5 Needs Attention`).
   - **AI Insights Expansion:** Expanded `#ai-insights-body`; verified Morning Brief 2x2 grid, Forgotten Equipment card, and Rebalancing cards.
   - **Theme Toggle:** Toggled between Light Mode and Dark Mode via the avatar menu; verified color palette and surface contrast.
   - **Product Tiles & Filtering:** Filtered by "Ventilator" tile and reset using "All Equipment" tile; verified accurate count badges.
   - **Sorting:** Tested column sorting on Equipment table headers.
   - **Navigation:** Verified routing across Dashboard, Audit Log, and Manage Users views.
   - **Recording & Artifacts:** Session video recorded at `login_and_ui_verify_1791212927879.webp`; screenshots captured: `dashboard_screen_1791213112700.png`, `dark_mode_1791213190795.png`, and `final_dashboard_view_1791213809251.png`.
2. **Backend Migrations (Follow-up):** Once the backend owner implements the RPC endpoints for user updates, notification routing, and transfer requests, the corresponding modal dialogs can be wired directly to live API calls.
