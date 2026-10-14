
# MOBILE_UI_SPEC.md

## 0. Mission and absolute rules

**Mission:** on phones (viewport width **≤ 767px**) show a compact, app-like UI (bottom navigation, bottom sheets, dense list, 1-tap room chips). On everything wider, the website must remain exactly as it is today.

### 0.1 Absolute rules (violating any of these = task failed)

1. **Desktop identical.** At widths **768, 1024, 1280, 1440, 1920** every page (Dashboard with insights collapsed and expanded, Audit Log, Manage Users, login) must have **zero pixel difference** vs. the baseline captured in Phase 0, in light and dark.
2. **Additive only.**
   - Create new files: `mobile.css`, `mobile.js` (names may follow repo conventions, e.g. under `/css` and `/js`).
   - **Do not edit, reorder, reformat, or delete any existing CSS rule.** `git diff` of existing `*.css` files must show **0 removed lines and 0 changed lines**.
   - Existing JS and HTML may only receive the **minimal hooks listed in section 2.5** (each one is additive and must be listed in the report).
3. **Scoped to mobile.** Every rule in `mobile.css` lives inside `@media (max-width: 767px) { … }` (except the 3-line default-hide block in 2.3). Mobile JS only runs when `matchMedia('(max-width: 767px)').matches`.
4. **No new frameworks or libraries.** The prototype uses the Tailwind CDN, Google Fonts links, and a phone-frame mock. **None of these go into the app.** Write plain CSS using the app's **existing design tokens** (CSS variables such as `--surface`, `--border`, `--text`, `--text-2`, `--primary`, …). If the prototype's hex values differ from the app's tokens, **the app's tokens win**.
5. **Prototype data and logic are mock.** Functions like `quickToggleEq`, `submitQuickRequest`, `resolvePhoneReq`, arrays like `phoneEquipment`, `phoneRequests`, `phoneAudit`, hard-coded numbers (`39`, `22`, `14 Checkouts`, `494 events`, `14 Oct`) and toasts such as "Desktop Print Layout Prepared" are **placeholders**. Replace them with real calls to the app's existing functions/Supabase code. No hard-coded data in the shipped UI.
6. **Do not change permissions or business logic.** Who can check out, release, request, approve, reject, force-release, create users, deactivate, etc. must be exactly what the desktop app does today. If the prototype shows an action to a role that desktop does not allow, **desktop wins**.
7. **Do not delete or modify any database records.** Do not alter API values, enum values, route names or DB schema.
8. **No service worker, no offline caching** in this task (it can break realtime and show stale hospital data).
9. **Never test destructive flows on production** (see section 9.4).

### 0.2 Definition of done for every ID

- [ ] Implemented as specified.
- [ ] Acceptance criteria pass.
- [ ] Verified in light **and** dark mode.
- [ ] Verified for **Manager, Senior Doctor, Staff**.
- [ ] Verified at 390×844, 375×667, 360×640, 412×915 (and 320×568 does not break: no horizontal scroll, nothing unreachable).
- [ ] Desktop regression diff still **0**.
- [ ] No new console errors/warnings.

---

## 1. Inputs and how to read the design file

The design file `meditrack_mobile_ui_design.html` has three studio tabs. **Only tab 1 ("Interactive Mobile Renders") is the design.** Tabs 2 and 3 are explanatory ("Before vs After", "UX report + CSS patch").

- Open it in a browser. In tab 1, use the **Role** dropdown (Manager / Senior Doctor / Staff) and the **Dark Phone** toggle. Click every bottom-nav tab, open an equipment row (bottom sheet), press the center **Scan** button (scanner sheet + room chips), open Requests, Audit, and the last tab.
- Take reference screenshots of each state into `docs/mobile/reference/`.
- Ignore studio-only parts: the top "MediTrack Mobile UI Studio" bar, phone frame (`.phone-frame`, `.phone-notch`), `.fold-marker`, explanatory cards, the "Before" phone, Tailwind classes.
- **Tab 3's CSS patch is a partial, CSS-only approach and is NOT sufficient** to build the design (it cannot create a bottom nav, tabs, bottom sheets or room chips). Use it only as hints. **Do not paste it as-is.** Its line numbers and selectors (`styles.css:395`, `.kpi-grid`, `.product-tiles-grid`, `#print-all-btn`, `#requests-panel`, `#room-picker-select`, `.eq-row`, …) came from an older version of the site. **Search the current code to find real selectors; never trust the line numbers.**

---

## 2. Architecture (follow this unless Phase 0 proves it impossible)

### 2.1 Approach

A small **mobile controller** (`mobile.js`) that:

- mounts a new mobile shell (`#m-app`) **only** when the viewport is ≤ 767px;
- renders from the **same in-memory state/data the desktop already uses** (no second data fetch layer, no second realtime subscription);
- calls the **same existing functions** for every action (check out, release, request, approve, reject, add product, print QR, create user, reset password, deactivate, reactivate, run weekly analysis, export CSV, logout, theme toggle);
- hides the desktop shell with CSS inside the media query while mobile is active (the desktop DOM stays in the document, untouched).

For surfaces that already exist as modals/forms (Add Product, Create User, password reset, QR print), **prefer re-using the existing DOM/modal and restyling it via `mobile.css` as a full-screen sheet** instead of rebuilding the form. Build brand-new DOM only for things that do not exist today: bottom navigation, equipment bottom sheet, room chips, mobile list rows, the Requests/Audit/More screens.

### 2.2 Naming (avoid collisions)

- All new IDs/classes use the prefix `m-` (e.g. `#m-app`, `.m-nav`, `.m-sheet`, `.m-row`).
- All new CSS variables use `--m-*` and are **derived from existing tokens** (e.g. `--m-surface: var(--surface);`). Only create new raw values for things with no existing token (heights, radii).

### 2.3 Default-hide block (the only rule outside the media query)

```css
/* mobile.css — top of file */
#m-app, .m-sheet-backdrop, .m-toast, .m-nav { display: none; }   /* never visible on desktop */

@media (max-width: 767px) {
  /* everything else lives here */
  html.m-boot body > :not(#m-app):not(script):not(.m-sheet-backdrop):not(.m-toast) { /* see 2.4 */ }
}
```

### 2.4 Mount, teardown and no flash of the desktop UI

1. **Early flag** (tiny inline script in `<head>`, additive):
   ```html
   <script>
     if (window.matchMedia('(max-width: 767px)').matches) document.documentElement.classList.add('m-boot');
   </script>
   ```
   and in `mobile.css` (inside the media query) hide the desktop shell while `html.m-boot` is present, so the desktop layout never flashes on phones.
2. **Controller:**
   ```js
   const MQ = window.matchMedia('(max-width: 767px)');
   let active = false;
   function sync() {
     if (MQ.matches && !active) { mountMobile(); active = true; }
     else if (!MQ.matches && active) { unmountMobile(); active = false; }
   }
   MQ.addEventListener('change', sync);   // rotation, devtools resize, split-screen
   sync();
   ```
3. `unmountMobile()` must remove **all** classes it added (`m-boot`, `m-active`), remove `#m-app`, sheets, listeners and timers, and restore scroll/overflow styles, so the desktop view returns **exactly** as before if the window is widened. Add a test (T-M07).
4. The mobile shell must wait for the app's auth/session state. It must not render protected UI before login and must not create a second login flow. The **login screen** keeps its current layout; only apply minimal mobile polish in `mobile.css` (inputs 16px, safe-area padding, no horizontal scroll).

### 2.5 Allowed hooks in existing files (list each in the report)

- `index.html`: add the `<link>` to `mobile.css`, the `<script>` to `mobile.js` (after `app.js`), the early `m-boot` script, and update the viewport meta to include `viewport-fit=cover` (needed for `env(safe-area-inset-*)`): `width=device-width, initial-scale=1, viewport-fit=cover`. Also add `<meta name="theme-color">` if missing. Nothing else.
- `app.js`: if there is no clean way to read state or call actions, add **only**:
  - a read-only accessor/export (e.g. `window.MediTrack = { getState, actions: {...} }`) exposing **existing** functions, and
  - a one-line event dispatch after the existing render/realtime handlers: `document.dispatchEvent(new CustomEvent('meditrack:render'))`.
  - No logic changes. No signature changes. Existing behaviour must not change.

---

## 3. PHASE 0 — Discovery and baseline (NO EDITS YET)

### 3.1 Discovery (write the answers at the top of `MOBILE_QA_REPORT.md`)

```bash
ls -la && cat package.json 2>/dev/null
ls | grep -Ei "index|styles|app|vercel|manifest"
grep -nE "@media" styles.css                       # existing breakpoints
grep -nE "DEPT_ROOMS|room-picker|requests-panel|print-all|kpi-grid|product-tiles|eq-row|eq-panel" index.html styles.css app.js
grep -nE "supabase|channel\(|subscribe\(|realtime" app.js
grep -nEi "scan|qr|html5-qrcode|BarcodeDetector|getUserMedia" app.js index.html
grep -nEi "role|isManager|isSenior|canApprove|permission" app.js
grep -nEi "toast|modal|confirm|dialog" app.js
grep -nE "localStorage|sessionStorage" app.js
```

Answer in writing:

1. Stack (vanilla HTML/CSS/JS? build step? Tailwind? Vercel?). Existing token names (`--surface`, `--border`, `--text`, `--text-2`, `--text-3`, `--primary`, status colours…).
2. Existing breakpoints and what they do (the prototype mentions `max-width: 639px`). Decide how `mobile.css` coexists with them (mobile mode hides the desktop shell, so desktop media rules become irrelevant at ≤ 767px, but they must remain in the file untouched).
3. **Feature inventory table** (fill every row from the real code):

   | Desktop feature | Where in code | Roles allowed | Mobile home (see section 5) |
   |---|---|---|---|
   | KPI cards (Available / In use / Needs attention / Pending requests / Total) | | | KPI strip |
   | AI Insights: Morning Brief, Forgotten Equipment, Rebalancing, Weekly Deep Analysis (Run / View report) | | | More tab |
   | Product-type filter | | | Product pills |
   | Search, sort, status filter, department filter | | | Sticky filter bar |
   | Equipment row expand (all fields it shows, incl. QR, condition, history, actions) | | | Equipment sheet |
   | Check out (room picker) / Release / Request access / Force release | | | Sheet + Scanner |
   | Scan QR | | | Center FAB |
   | Add Product | | | More → Manager tools |
   | Print all QR / print one QR | | | More + Equipment sheet |
   | Pending requests: approve / reject | | | Requests tab |
   | Audit log: search, department/time/action filters, per-equipment history, Export CSV | | | Audit tab |
   | Manage Users: create, role, department, reset password, deactivate, reactivate | | | More → Manage users |
   | Theme toggle, logout, Live indicator | | | Header / More → Account |
   | (anything else found) | | | |

4. **Role/permission matrix:** for each action above, the exact desktop condition (role names as in code). The mobile gating must be generated from the **same conditions** (ideally the same helper functions).
5. Which existing functions can be called directly; which need the minimal hooks in 2.5.
6. How realtime updates re-render the desktop UI (so mobile subscribes via the same mechanism, not a duplicate channel).
7. How the QR scanner works today (library, camera constraints, fallbacks) — the mobile scanner re-uses it.
8. Definition of "Needs attention / Alerts" on desktop (maintenance? held > N hours?). Mobile "Alerts" must use **the same function**.
9. Which data fields exist for an item (qr code, dept, type, condition, status, holder, room, since). Do not invent fields.

### 3.2 Baseline (before touching any file)

```bash
git checkout -b feature/mobile-ui && git tag pre-mobile-baseline
```

- If Playwright is not installed: `npm i -D @playwright/test && npx playwright install chromium`.
- Capture **desktop baseline screenshots** (full page) into `tests/baseline/desktop/` for widths **768, 1024, 1280, 1440, 1920**, light + dark, for: login, dashboard (insights collapsed), dashboard (insights expanded), audit log, manage users. Use a **seeded test project or mocked network** so the data is identical between runs (freeze time with `page.clock` or mask relative-time text, e.g. "2d ago").
- Capture **mobile "before" screenshots** at 390×844 and 360×640 into `tests/baseline/mobile-before/`.
- Run lint/build/tests and record the pre-existing results.

---

## 4. Design tokens for mobile (derive from existing tokens)

```css
@media (max-width: 767px) {
  :root {
    --m-header-h: 52px;
    --m-nav-h: 56px;
    --m-safe-top: env(safe-area-inset-top, 0px);
    --m-safe-bottom: env(safe-area-inset-bottom, 0px);
    --m-radius-sheet: 20px;
    --m-radius-card: 12px;
    --m-radius-pill: 999px;
    --m-tap: 44px;            /* minimum comfortable target */
    --m-row-h: 60px;
    --m-z-header: 30; --m-z-nav: 40; --m-z-sheet: 60; --m-z-toast: 70;
  }
}
```

Typography (mobile): row title **15px/600**, meta **12.5px/400** (colour `--text-2`), labels/badges **12px/600**, KPI numbers **20px/700** with `font-variant-numeric: tabular-nums`, nav labels **11px/600**. **Nothing below 11px anywhere. Any `<input>`, `<select>`, `<textarea>` must be `font-size: 16px`** (iOS Safari zooms the whole page on focus when the font is smaller — this is part of the original "zoomed in" complaint).

Colours: use the **same status tokens/classes the desktop uses** for Available / In use / Maintenance / Inactive (see PL-04). Semantic rule: green = available/active, the existing "in use" colour = in use, amber = needs attention, red = destructive/critical only.

---

## 5. SCREEN SPECIFICATIONS (M-IDs)

> The structure follows the prototype (tab 1). Dimensions below are the **polished** values.

### M-01 · App shell and viewport

- `#m-app` fills the viewport: `min-height: 100dvh` (fallback `100vh`), `display:flex; flex-direction:column`.
- Content scrolls with the **document** (not a nested fixed-height scroll box), so the browser URL bar collapses naturally. Add `padding-bottom: calc(var(--m-nav-h) + var(--m-safe-bottom) + 16px)` so nothing hides behind the nav.
- Global mobile touch rules: `-webkit-tap-highlight-color: transparent; touch-action: manipulation;` on interactive elements; `overscroll-behavior: contain` on sheets; `html { -webkit-text-size-adjust: 100%; }`.
- **Acceptance:** no horizontal scroll at 320–767px (`document.documentElement.scrollWidth <= window.innerWidth`); no content hidden behind the nav; no layout jump when the browser URL bar shows/hides.

### M-02 · Header (compact)

- Height `var(--m-header-h)` + top safe area; sticky at top; background `--surface`; bottom border `--border`.
- Left: app logo (28px) + "MediTrack" (15px/700) + **Live** chip (reflects the **real** realtime state: Live = connected, "Offline" grey when disconnected; no always-on fake pulse; pulse disabled under `prefers-reduced-motion`).
- Right: role pill (12px, from the real logged-in role) + avatar button (36px visible, 44×44 tap area) showing the real user's initials. **Avatar opens the Account area (More tab → Account card).**
- **Acceptance:** role pill/initials come from the session, never hard-coded; header never overlaps the status bar/notch.

### M-03 · Bottom navigation (thumb zone)

- Fixed to the bottom: height `var(--m-nav-h)` + safe-area-bottom padding; `<nav aria-label="Primary">`; top border; `--surface` background.
- Items (left → right): **Equipment**, **Requests** (badge with the live pending count; hidden at 0; `aria-label="Requests, N pending"`), **Scan** (center FAB), **Audit**, **More**.
- **Role-based items:** generate the tab list from the **real permissions** found in Phase 0. If a role cannot see a screen on desktop (e.g. Audit Log or Manage Users), that tab/section is **not rendered** for that role; the nav re-flows (4 items + FAB works with CSS grid `grid-auto-flow: column` / flex). The prototype shows all tabs to all roles — **desktop rules win** (PL-24).
- Tab buttons: icon 22px + label 11px, min tap target 48×48, `aria-current="page"` on the active tab, active colour `--primary`.
- **Scan FAB:** 56×56 rounded (16–18px radius), raised ~16px above the bar, gradient/`--primary`, icon + "Scan" label (11px), `aria-label="Scan equipment QR code"`, `:active` scale .96 (not under reduced-motion).
- **Keyboard open:** when any input/textarea/select is focused, hide the nav and FAB (`.m-keyboard-open` class toggled via `focusin`/`focusout`, and `visualViewport` resize) so they don't float over the on-screen keyboard.
- **Acceptance:** tapping switches screens without a page reload; state of the previous tab (scroll position, filters) is preserved when returning.

### M-04 · Equipment tab — KPI strip

- 4 equal tiles in one row: **Available**, **In use**, **Alerts**, **Requests**. Gap 8px, tile min-height 56px, radius 12px, border `--border`, `--surface` background.
- Label **12px** (use full words: "Available", "In use", "Alerts", "Requests"; if "Available" doesn't fit at 320px, allow `Avail.` below 340px only), value **20px/700 tabular-nums**, small status dot top-right.
- **Values are computed from real data**, using the same functions as the desktop KPI cards (PL-13, PL-23). **Alerts = same definition as desktop "Needs attention".**
- Tapping Available / In use / Alerts toggles the status filter on the list below; tapping Requests opens the Requests tab.
- **Active state (PL-12):** the active filter tile gets a 2px `--primary` border and `aria-pressed="true"`. Tapping again clears the filter.
- Each tile is a `<button>` with an accessible name like "Available, 39 items. Filter list."
- **Acceptance:** numbers equal the desktop KPI numbers for the same data; the strip height ≤ 64px.

### M-05 · Attention banner (1 item high, 2 lines allowed)

- Shown only if Alerts > 0, using the same count as the Alerts tile. Text from real data: "**N items** need attention" (+ the reason in the existing wording of the app). Button 1 (whole banner text) → applies the Alerts filter; button 2 "AI brief →" → More tab, AI Insights section. Min height 40px, text 12–13px, **wraps instead of truncating**.
- Replace the ⚠️ emoji with an SVG icon (PL-03).

### M-06 · Product-type pills

- Horizontal scroller: `display:flex; gap:8px; overflow-x:auto; scroll-snap-type:x proximity; scrollbar-width:none;` with a subtle fade on the right edge when scrollable.
- Pill height 36px, text 13px/600, shows icon + short name + count. **Use the same product images/icons the desktop tiles use** (20px, `object-fit:contain`) with a neutral SVG fallback; **no emoji** (PL-03).
- Types and counts come from **real data**; **every product type that exists in the data gets a pill** (the prototype hard-codes 5 types — do not copy that).
- Selected pill: `--primary` background + white text; `aria-pressed`. Tapping the selected pill again clears it. First pill is "All".

### M-07 · Sticky search + filters (≤ 96px tall in total)

- `position: sticky; top: calc(var(--m-header-h) + var(--m-safe-top)); z-index: 20;` background `--surface`, bottom border.
- Row 1: search input (height **40px**, **font-size 16px**, placeholder "Search equipment, ID, holder…", `type="search"`, clear button) + status segmented control (All / Available / In use, height 36px, each segment ≥ 44px wide, 13px text, `role="radiogroup"`).
- Row 2: department chips (height **32px**, 12–13px text, 8px gap, horizontal scroll, snap). Chips: "All depts" + every real department.
- When any filter is active show a tiny line below: "Showing 12 of 61 · **Clear filters**" (button resets status, department, type, search).
- Sorting: if the desktop has a sort select (`eq-sort-select`), expose it as a compact icon button in row 1 opening a small action sheet (same options as desktop).
- **Acceptance:** sticky bar ≤ 96px; search focus does **not** cause page zoom on iOS (16px); Clear filters restores the full list.

### M-08 · Equipment list rows

- Row min-height **60px**, padding 10px 12px, divider `--border`, full-row tap target (it's a `<button>`/`role="button"` with an accessible name: "Ventilator A, ICU, In use. Open details").
- Line 1: **name** (15px/600, single-line ellipsis). Line 2 (12.5px, `--text-2`, ellipsis):
  - Available: `Department · Condition`
  - In use: `Department · Room · Holder (held for 2h 15m)`
- Right: **status badge** with the full label (Available / In use / Maintenance / …) + chevron (16px). Badge uses the same shared status styling as desktop.
- The QR/asset ID is **not** in the row (it moves to the sheet, M-09) but **is searchable**. (Resolves the prototype inconsistency, PL-22: the prototype's "Check Out / Release button on every row" text is not in its interactive version; **do not add inline buttons** — row tap opens the sheet.)
- Durations are computed from real `since` timestamps and tick over without a page reload (update at most once a minute).
- **Performance:** render in chunks of **30** with a "Show 30 more" button at the end (only on mobile, in `mobile.js`).
- Row tap → open the Equipment sheet (M-09). Keep scroll position when the sheet closes.
- **Acceptance:** at 390×844 the first row is visible without scrolling past anything but the compact header, KPI strip, banner, pills and sticky bar; ≥ 6 rows are visible on a 390×844 screen.

### M-09 · Equipment bottom sheet (replaces inline row expansion)

- Bottom sheet component (see M-14) with: grabber, header (**name**, **asset/QR ID** in monospace chip, department, condition), status badge, close button.
- Must contain **every piece of information and every action that the desktop expanded row has today** (from the Phase 0 inventory), including: the **QR code image** (the prototype omits it — PL-07), "Print this QR", condition/maintenance info, last activity/history if desktop shows it.
- **If Available:** room chips (M-10 behaviour) + primary button "Mark in use". **If In use:** location + holder + held-for; actions exactly per desktop rules: "Release" (if the user may release), "Request access" (roles that may), **"Force release" only for roles the desktop allows and always behind a confirm** (PL-06).
- Primary button height 48px; secondary 44px; full width; destructive uses the danger style and a confirm (M-15).
- **Live conflict handling (PL-17):** if the item's status changes while the sheet is open (someone else checked it out), update the sheet in place and show an inline notice: "Just checked out by *name* in *room*." and disable the stale action.
- **Acceptance:** each action produces the same database effect and audit entry as the desktop equivalent; the sheet updates live.

### M-10 · Room chips (1-tap room selection)

- Chips are built from the **real** `DEPT_ROOMS` map for the item's department (fallback to the same fallback the desktop uses).
- Chip height 36px, min-width 56px, 13px/600 text, wrap to multiple lines with 8px gaps.
- **No room is pre-selected (PL-05).** The confirm button is **disabled** and reads "Select a room" until a chip is tapped; after selection it reads "Confirm check-out to *Room*". (Wrong location in a hospital system is worse than one extra tap.)
- Selected chip: `--primary` background, white text, `aria-pressed="true"`; chips in `role="radiogroup"`.

### M-11 · Scan flow (center FAB)

- Re-use the app's **real scanner code and camera logic**; only the UI shell is new. Full-height sheet (≤ 92dvh) with: header ("Scan equipment QR"), live camera viewfinder (rounded, with a visible scan frame), helper text, torch button, "Enter code manually" field.
- **Do not copy the fake "Tap to simulate scan" buttons** or the 1-second auto-simulated scan from the prototype (`openMobileScanner()` calls `simulateQrScan('MT-OT-001')` immediately — that's a demo only).
- States that must exist (PL-20):
  1. **Requesting permission** (spinner + text).
  2. **Permission denied / no camera** → clear message + the manual code field + link "How to enable camera".
  3. **Scanning** (viewfinder).
  4. **Found – available** → item summary + room chips + confirm (M-10).
  5. **Found – in use (conflict)** → show who/where/how long; actions per role rules: "Request handover" (if allowed), "Release" / "Force release" (only roles allowed, behind confirm).
  6. **Not found / invalid code** → message "No equipment with code *X*", "Scan again".
- **Torch button only if the device supports it** (`track.getCapabilities().torch`).
- On success: stop camera tracks immediately when the sheet closes (no camera light left on). Optional haptic `navigator.vibrate?.(15)`.
- Handle closing: ✕ button, backdrop tap, Android back button, `Esc`.

### M-12 · Requests tab

- Header: "Pending requests" + count badge. List of request cards: priority badge (use the existing priority names), equipment name + QR ID, "Requested by *user* · *dept*", relative time. Buttons for roles allowed to approve/reject on desktop: **Approve** (primary 44px) and **Reject** (secondary 44px). Roles that can't approve see the read-only note the desktop shows (or "Awaiting approval").
- **Reject confirmation (PL-27):** the prototype's "tap again to confirm" must be replaced with the shared confirm sheet (M-15), or if kept, it must reset after 3 seconds, announce itself to screen readers, and have a clearly different style. Prefer the confirm sheet.
- Empty state: icon + "No pending requests" + "New equipment requests will appear here." (no emoji).
- Live: new/resolved requests update list and nav badge in real time via the existing realtime mechanism.
- **Acceptance:** approve/reject produce the same effect as desktop; counts in nav badge, KPI tile and tab header always match.

### M-13 · Audit tab (parity with desktop Audit Log)

The prototype shows only a flat list of 5 mock events. The mobile Audit tab must provide the **same capabilities as the desktop Audit Log** (only for roles that can access it on desktop):

- Header: "Audit log" + total events count (real) + **Export CSV** button (calls the existing export; exports the **currently filtered** set, same as desktop).
- Search input (16px) + a **Filters** button opening a filter sheet with the same three filters as desktop (Department, Time range, Action) and "Apply" / "Reset".
- Summary chips (real numbers): "N total events", "N items used today", "N in use now", with the same definitions as desktop.
- List: per-equipment rows as on desktop (name, department, uses count, last activity "2d ago by user"), sorted as desktop. Tapping a row opens a bottom sheet with that item's **event history** (newest first; each entry: action, user, room, date-time).
- Pagination: load 25 rows at a time with "Show more".
- Empty state ("No events match your filters" + Reset filters).
- **Acceptance:** for the same filters, mobile and desktop show the same rows/counts and the CSV content is identical.

### M-14 · Bottom sheet component (shared)

Used by: equipment sheet, scanner, filter sheets, confirm dialogs, user forms.

- Structure: backdrop + sheet (`role="dialog" aria-modal="true" aria-labelledby=…`), grabber, sticky header with title and a 44×44 close button, scrollable body, sticky action footer with safe-area padding.
- Style: `border-radius: 20px 20px 0 0; max-height: 88dvh; box-shadow: 0 -12px 32px rgba(0,0,0,.25)`; backdrop `rgba(0,0,0,.5)`.
- Behaviour (all required — PL-15):
  - Open/close animation 220ms `cubic-bezier(.2,.8,.2,1)` (instant under `prefers-reduced-motion`).
  - **Lock body scroll** while open (iOS-safe: `position:fixed` technique or `overflow:hidden` + preserve scroll position), restore exact scroll on close.
  - **Android/browser Back button closes the topmost sheet** instead of leaving the page: `history.pushState({m:'sheet'}, '')` on open; `popstate` closes; on programmatic close call `history.back()` only if the state is ours.
  - Swipe-down on the grabber/header closes (optional but recommended; threshold ~100px).
  - `Esc` closes; backdrop tap closes (except for forms with unsaved input → confirm).
  - **Focus trap**; initial focus on the first interactive element (or the Cancel button for destructive confirms); focus returns to the trigger on close.
  - Stackable: a confirm sheet can open above another sheet.

### M-15 · Confirm sheet (shared)

Title, body, Cancel (secondary) and Confirm (primary, or danger for destructive). Used for: force release, reject request, deactivate user, reset password, and anything else the desktop confirms (**plus** any destructive action that the desktop does without confirming must keep its desktop behaviour; do not silently add steps to non-destructive actions).

### M-16 · More tab (everything that has no tab)

Order of sections (single scroll column):

1. **Account card:** avatar, username, role badge, **Theme toggle** (Light/Dark, wired to the existing theme logic and persisted exactly as desktop does), **Log out** button (existing logout). *(The prototype has no theme toggle or logout — PL-08.)*
2. **AI insights** (collapsible section, each card collapsible): **all** desktop insight cards — Morning Brief, Forgotten Equipment, Rebalancing Suggestion, and (Manager only, as desktop) Weekly Deep Analysis with **Run weekly analysis** and **View report** (PL-10). Data is the real generated data; if none, show the same empty/"not generated yet" state as desktop. The model name is not shown in the default state (tooltip/info only). No hard-coded sentences or dates (PL-13).
3. **Department availability** (optional, derived): one row per department: `ICU — 9 of 14 available` with a bar whose width = **available ÷ total** (the prototype's bars (36%, 33%) contradict its labels (9 of 14 = 64%) — PL-11). If the real data cannot produce this reliably, omit the section and note it in the report.
4. **Manager tools** (only roles that have them on desktop): **Add Product** (opens the existing Add Product form restyled as a full-height sheet; calls the real create function; QR is auto-generated exactly like desktop), **Print all QR** (existing function; if printing isn't supported in the mobile browser show the same fallback as desktop or a clear message), **Manage users** (M-17).
5. **Switch to classic (desktop) view** link → sets `localStorage['meditrack.classicView']='1'` (try/catch) and reloads; with that flag `mobile.js` does not mount. A "Back to mobile view" link must exist in the classic view's footer **via mobile-scoped CSS only if possible**; otherwise document `?mobile=1` to reset. (Safety valve; the desktop UI itself is unchanged.)
6. App version / environment text if the desktop shows one.

### M-17 · Manage users (Manager only; sub-screen of More)

Full parity with desktop — the prototype only shows 2 users with a "Reset" button and mislabels them "Active Staff (8 Users)" (PL-09):

- List **all** users (real data) as compact cards: username, role badge (existing role styling), department, status badge (Active / Inactive; **Inactive is grey, not red**), and a **⋯ actions button** (44×44) opening an action sheet with: **Reset password**, **Deactivate** / **Reactivate**. Hide actions on the current user's own row exactly like desktop.
- Search + status segmented filter (All / Active / Inactive) with counts.
- **Create user** (primary button at top or sticky footer): sheet with Username, Role, Department — same fields, validation, role/department options and success/error behaviour as desktop; inputs 16px; inline errors; submit disabled until valid.
- Every destructive/sensitive action (deactivate, reset password) uses the confirm sheet with wording consistent with desktop.
- After a reset password, show whatever the desktop shows (temporary password, etc.) in a sheet with a "Copy" button.
- **Acceptance:** every user action works and produces the same DB effect as desktop; non-managers cannot reach this screen.

### M-18 · Toasts

- `role="status" aria-live="polite"`; position: `bottom: calc(var(--m-nav-h) + var(--m-safe-bottom) + 12px)`; auto-dismiss 3s (errors stay until dismissed); max width 92vw; one at a time (queue).
- **Remove the prototype's decorative "LIVE" tag** inside toasts (PL-14).
- Toasts are shown **only after the real action succeeded** (or failed). Never show "success" for an action that did not run (no fake "Desktop Print Layout Prepared").

### M-19 · Loading, empty, error and offline states (PL-18)

- **Initial load:** skeletons for KPI strip, 6 list rows, and pills (no blank flash).
- **Empty list:** "No equipment matches your filters" + Clear filters.
- **Network/DB error:** inline banner "Couldn't load data" + Retry.
- **Offline / realtime lost:** header chip changes to "Offline", a non-blocking banner "You're offline — showing last known data" and **all write actions are disabled** with an explanation (never queue clinical actions silently).
- Pull-to-refresh is **not** required.

### M-20 · Dark mode

All mobile components must use tokens so that the existing dark theme works with no extra work. Verify every screen and every sheet in dark mode. Surfaces use `--surface`/`--surface-2`, never hard-coded `#fff`. Camera viewfinder stays dark in both themes.

---

## 6. MOBILE PLATFORM DETAILS (do all)

1. **Viewport & safe areas:** viewport meta with `viewport-fit=cover`; header gets `padding-top: env(safe-area-inset-top)`; nav/sheets get `padding-bottom: env(safe-area-inset-bottom)`; left/right insets respected in landscape.
2. **`dvh` units** with `vh` fallback (`height: 100vh; height: 100dvh;`).
3. **No iOS input zoom:** all form controls 16px font on mobile (login included).
4. **Tap targets:** primary controls ≥ 44×44; chips/segments ≥ 32px tall with ≥ 8px spacing between targets (WCAG 2.2 AA minimum is 24px; we aim higher for gloved/one-handed clinical use).
5. **Horizontal scrollers** (pills, dept chips): `scroll-snap`, hidden scrollbars, no vertical scroll hijack, inertia scrolling (`-webkit-overflow-scrolling: touch` not needed on modern iOS).
6. **Back button handling:** sheets push history state (M-14). Bottom-nav tab switching does **not** create history entries (or if it does, Back returns to Equipment tab then exits) — pick one and document it.
7. **Rotation / resize:** layout works in landscape ≤ 767px width; if width crosses 768px the desktop UI returns cleanly (T-M07).
8. **Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables slide, pulse, scale and shimmer.
9. **Text selection/long-press:** allow selecting QR IDs and usernames (`user-select: text` on those).
10. **Large text (OS font scaling):** layouts must not break at 130% system font size (rows grow, no clipping of status badges).
11. **Dates/times:** formats identical to desktop's (don't invent new formats).

---

## 7. POLISH FIXES vs. THE PROTOTYPE (these OVERRIDE the prototype)

| ID | Problem in the prototype | Required fix |
|---|---|---|
| PL-01 | Tap targets too small: avatar 28px, search 32px, segmented ~26px, dept chips ~20px, nav labels crowded | Use sizes in section 5/6 (avatar 36 visible/44 target, search 40, segmented 36, chips 32, rows 60, nav 56 + safe area) |
| PL-02 | Text at 10px everywhere; inputs at 12px (causes iOS zoom) | Minimum 11px for labels, 12–13px meta, 15px titles; inputs 16px |
| PL-03 | Emoji used as icons (⚠️ ✨ 📷 ➕ 🖨️ 🔦 🎉 🫁 ♿ 💉 ⚡ 🖥️ 🏥) | Replace with inline SVG icons in one consistent style (reuse the app's icon approach if it has one) and the app's real product images |
| PL-04 | "In Use" is red (same colour as danger/conflict/reject); abbreviations ("Avail", "Maint") | Use the **same status tokens/classes as desktop** (whatever colour desktop uses for In use); reserve red for destructive/critical; full labels; status never conveyed by colour alone (dot/label) |
| PL-05 | First room is pre-selected → easy wrong check-out location | No pre-selection; confirm disabled until a room is chosen |
| PL-06 | "Force Release" shown to every role in the scan conflict card | Role-gate exactly like desktop and always confirm |
| PL-07 | Equipment sheet has no QR code, no print-QR, fewer fields than desktop | Include everything the desktop expanded row has (QR, print QR, condition, history…) |
| PL-08 | No theme toggle or logout anywhere; account lives behind an "Insights" tab | Account card in More (theme + logout); rename last tab to **More** |
| PL-09 | Manage Users: 2 users, only "Reset", wrong label "Active Staff (8 Users)" | Full parity (M-17) |
| PL-10 | Only Morning Brief exists in the Insights area | All insight cards incl. Forgotten Equipment, Rebalancing, Weekly Deep Analysis (M-16) |
| PL-11 | Department bars contradict their labels (9 avail shown as 36%) | Bar = available ÷ total, label "9 of 14 available", or omit |
| PL-12 | KPI tiles have no active state; no way to see/clear filters | `aria-pressed`, 2px primary border, "Showing X of Y · Clear filters" |
| PL-13 | Hard-coded numbers/dates (39, 22, 3, 1, "14 Checkouts", "494 events", "14 Oct", "21h ago") | Everything from real data |
| PL-14 | Toast has a decorative "LIVE" label and fake stub messages | Remove; real success/failure only |
| PL-15 | Sheets only close by tapping the backdrop; Android Back leaves the page; body scrolls behind | M-14 behaviours (Back button, scroll lock, focus trap, swipe) |
| PL-16 | Fixed nav overlaps the on-screen keyboard | Hide nav/FAB while an input is focused |
| PL-17 | No handling when an item changes while its sheet is open | In-place update + notice (M-09) |
| PL-18 | No loading / error / offline states | M-19 |
| PL-19 | `--text-3` grey used for 10–11px text (low contrast, < 4.5:1) | Use `--text-2` or darker for any text < 14px; `--text-3` only for decorative/disabled |
| PL-20 | Scanner is simulated; torch always shown; no permission/manual states | M-11 |
| PL-21 | Audit tab is a flat 5-item mock without filters/history | M-13 parity |
| PL-22 | Prototype text promises inline Check-out/Release buttons on rows but the interactive version opens a sheet | Sheet only; no inline buttons |
| PL-23 | "Alerts" meaning unclear | Same definition and function as desktop "Needs attention" |
| PL-24 | All five tabs shown to all roles | Role-based tabs/sections from real permissions |
| PL-25 | Studio chrome in the design (phone frame, notch, fold marker, Tailwind CDN, Google Fonts `<link>`) | Do not ship; use the app's existing font loading |
| PL-26 | Fixed 375×780 phone size | Fluid 320–767px; test 320, 360, 375, 390, 412, 600, 767 |
| PL-27 | Reject uses "tap again to confirm" with no reset | Confirm sheet (or 3s reset + announcement) |
| PL-28 | Long lists rendered at once; long names unhandled | Chunk rendering (30), ellipsis + full name in sheet |

---

## 8. ACCESSIBILITY (all required)

- Landmarks: `<header>`, `<nav aria-label="Primary">`, `<main id="m-main">`; one `<h1>` per screen (visually compact is fine; can be `.sr-only` if the header shows the title).
- Every icon-only button has `aria-label`. Badges' counts have text alternatives.
- Dialog semantics, focus trap and focus restoration on every sheet.
- Status is never colour-only.
- Contrast ≥ 4.5:1 for text < 18px in light **and** dark (run axe).
- Live regions: toasts (`role="status"`), request badge updates (`aria-live="polite"` on the count), conflict notices (`role="alert"`).
- Respect `prefers-reduced-motion`.
- Works with a hardware keyboard / switch access (Tab order logical, Enter/Space activate, Esc closes).

---

## 9. TESTING (REQUIRED)

### 9.1 Desktop regression (most important)

Run before and after each phase. **Zero pixel difference allowed.**

```js
// tests/desktop-regression.spec.js (Playwright)
import { test, expect } from '@playwright/test';
const widths = [768, 1024, 1280, 1440, 1920];
const pages = ['login', 'dashboard', 'dashboard-insights-open', 'audit', 'users'];
for (const w of widths) for (const theme of ['light','dark']) for (const p of pages) {
  test(`desktop ${p} ${w} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await gotoAs(page, 'Manager', p, theme);             // seeded/mocked data; freeze time
    await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
    await expect(page).toHaveScreenshot(`${p}-${w}-${theme}.png`, {
      fullPage: true, maxDiffPixels: 0,                    // ZERO
      mask: [page.locator('[data-relative-time]')],        // mask only relative-time text if needed
    });
  });
}
```

Additional guards:

```bash
# Existing CSS must have no removed/changed lines
git diff --numstat pre-mobile-baseline -- '*.css' ':!mobile.css'   # column 2 (deleted) must be 0 for every file
# Existing JS/HTML: review every changed line; only the hooks from 2.5 are allowed
git diff pre-mobile-baseline -- app.js index.html
```

```js
// Desktop must never contain visible mobile UI
test('mobile UI hidden on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoAs(page, 'Manager', 'dashboard');
  for (const sel of ['#m-app', '.m-nav', '.m-sheet-backdrop', '.m-toast'])
    for (const el of await page.locator(sel).all()) await expect(el).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.classList.contains('m-boot'))).toBe(false);
});
```

### 9.2 Mobile functional tests (Playwright, mobile emulation)

Devices: 390×844, 375×667, 360×640, 412×915; `hasTouch: true`, `isMobile: true`. Run for **each role**.

| ID | Test |
|---|---|
| T-M01 | Mobile mounts at ≤ 767px; desktop shell hidden; bottom nav visible with role-correct tabs (Manager/Senior Doctor/Staff match the permission matrix from Phase 0) |
| T-M02 | KPI numbers equal desktop KPI numbers for the same data (load desktop and mobile with the same fixture) |
| T-M03 | Status filter, department chip, product pill, search combine correctly; "Clear filters" resets; count text correct |
| T-M04 | Row tap opens sheet; sheet shows QR code and all fields the desktop expanded row shows |
| T-M05 | Check-out flow: no room preselected, confirm disabled until a chip is tapped; after confirm the item is In use with the chosen room; audit event created |
| T-M06 | Release / Request access / Force release obey the role matrix (Staff cannot force-release; destructive ones require confirm) |
| T-M07 | **Resize round-trip:** load at 390px, resize to 1280px → desktop UI identical to baseline and all mobile elements/classes removed; resize back to 390px → mobile UI mounts again, no duplicate listeners (click once = one action) |
| T-M08 | Scanner: permission granted (fake media stream), denied, manual code entry, invalid code, conflict card; camera tracks stopped on close |
| T-M09 | Requests: approve/reject (role-gated), nav badge + KPI + header counts agree; realtime update arrives while on another tab |
| T-M10 | Audit: filters, per-equipment history sheet, "Show more", Export CSV equals the desktop CSV for the same filters |
| T-M11 | More: theme toggle persists like desktop; logout works; all insight cards present; Weekly Deep Analysis only for the role that has it on desktop |
| T-M12 | Manage users (Manager): list parity, create, reset password, deactivate/reactivate with confirms; other roles cannot access |
| T-M13 | Sheets: Back button closes topmost sheet (page does not navigate away); body scroll locked; focus trapped and restored; Esc closes |
| T-M14 | Keyboard: focusing the search input hides the nav/FAB; no iOS zoom (computed font-size ≥ 16px for every input/select/textarea) |
| T-M15 | Offline: simulate offline → banner + write actions disabled; back online → recovers |
| T-M16 | Conflict: while an item's sheet is open, simulate another user checking it out → sheet updates with notice and the action is disabled |
| T-M17 | Classic-view switch: flag set → mobile does not mount, desktop layout shown on phone; reset path works |
| T-M18 | Dark mode: every screen/sheet rendered in dark with no hard-coded white surfaces (screenshot review + automated check that no element has computed `background-color: rgb(255,255,255)` in dark mode except images) |

### 9.3 Layout, size and accessibility audits

```js
// No horizontal scroll at each viewport
expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

// Tap target audit (fails the build under 32px; warn under 44px for primary controls)
const small = await page.evaluate(() =>
  [...document.querySelectorAll('#m-app button, #m-app a, #m-app [role=button], #m-app input, #m-app select')]
    .filter(el => el.offsetParent !== null)
    .map(el => ({ el: el.outerHTML.slice(0, 80), r: el.getBoundingClientRect() }))
    .filter(x => x.r.height < 32 || x.r.width < 32));
expect(small).toEqual([]);

// Font-size audit: inputs ≥ 16px; no visible text < 11px
```

- Run **axe** (`@axe-core/playwright`) on each mobile screen and each open sheet, light + dark: **zero serious/critical violations**.
- Run Lighthouse mobile (if available) and report Performance/Accessibility scores; no regressions in desktop scores.
- Manual keyboard + screen-reader smoke test (VoiceOver/TalkBack if available; otherwise document that it wasn't possible).
- Test at 320×568 (iPhone SE 1st gen) for "nothing unreachable", and at 767px width.

### 9.4 Test data safety

- Run mutating tests (check out, release, approve, reject, create/deactivate users, add product) only against a **test Supabase project** or with **network mocked** (`page.route`). **Never** against production. If neither exists, write the tests but mark them "not run" in the report and say why.
- Do not leave test records behind. Do not delete real records.

### 9.5 Commands that must pass

```bash
npm run lint      # if present
npm run build     # if present
npx playwright test
```

---

## 10. PHASES

1. **Phase 0** — discovery + baselines (section 3). No code edits.
2. **Phase 1 — Foundation:** hooks (2.5), `mobile.css`/`mobile.js` skeleton, mount/unmount, `m-boot`, shell, header, bottom nav, tokens, sheet component, toasts. Gate: desktop diff = 0, T-M01, T-M07, T-M13.
3. **Phase 2 — Equipment:** KPI strip, banner, pills, sticky filters, list, equipment sheet, room chips. Gate: T-M02–T-M06, T-M14, T-M16.
4. **Phase 3 — Scan + Requests:** scanner flow, requests tab. Gate: T-M08, T-M09.
5. **Phase 4 — Audit + More:** audit parity, account, insights, manager tools, manage users, classic-view switch. Gate: T-M10–T-M12, T-M17.
6. **Phase 5 — Quality:** loading/empty/error/offline states, dark mode pass, accessibility pass, small-screen pass (320/360), performance. Gate: T-M15, T-M18, axe, tap-target audit.
7. **Phase 6 (optional, only if everything above passes) — PWA basics:** `manifest.json` (name, icons, `display: standalone`, theme colour) + `apple-touch-icon` so staff can "Add to Home Screen". **No service worker.** Verify desktop is unaffected.

---

## 11. FINAL REPORT FORMAT (`docs/mobile/MOBILE_QA_REPORT.md`)

```markdown
# MediTrack Mobile UI — QA Report

## 1. Summary
- Stack found / approach used: …
- Desktop regression: PASS (0 px diff across N screenshots) / FAIL (details)
- Commands: lint ✅/❌ · build ✅/❌ · playwright ✅/❌ (N passed, N failed, N not run + why)
- IDs: M-01…M-20 and PL-01…PL-28 → Done: N · Partial: N · Skipped: N

## 2. Discovery answers (section 3.1) incl. feature inventory and role/permission matrix

## 3. Item status
| ID | Status (Done / Partial / Skipped) | Files changed | Verified by (test ID / manual) | Notes |
(one row for EVERY M-xx and PL-xx and every test T-M01…T-M18)

## 4. Changes to existing files (must be tiny)
| File | Exact lines added | Why |
(list every hook from section 2.5; confirm 0 deleted/changed lines in existing CSS)

## 5. Deviations from the prototype and why

## 6. Assumptions made

## 7. Needs owner input / backend work
- …

## 8. Known issues / follow-ups

## 9. Screenshots index (docs/mobile/screens/…): role × screen × theme × device
```

**Self-audit (mandatory):** before finishing, re-read sections 0, 5, 6 and 7. For every ID, open the running app (mobile emulation) and confirm it yourself or with a test. If any ID lacks a row in the report, you are not done.

---

## APPENDIX A — Checklist of tiny details (tick each in the report)

**Desktop safety**
- [ ] 0 px diff on desktop widths 768–1920, light + dark
- [ ] 0 removed/changed lines in existing CSS
- [ ] Only the listed hooks changed in `index.html` / `app.js`
- [ ] Resize round-trip (390 ↔ 1280) restores desktop exactly

**Look & feel**
- [ ] No emoji icons anywhere; SVG icons consistent
- [ ] Status badges use the same colours/classes as desktop, full labels, never colour-only
- [ ] Red used only for destructive/critical
- [ ] No text under 11px; inputs 16px
- [ ] Tap targets ≥ 44px primary / ≥ 32px chips
- [ ] No `--text-3` on small text
- [ ] No Tailwind, no phone frame, no studio chrome, no new font links

**Behaviour**
- [ ] No hard-coded numbers, dates or names
- [ ] No fake toasts; success only after real success
- [ ] Role gating identical to desktop (nav tabs, force release, approve/reject, manage users, weekly analysis)
- [ ] No room pre-selected; confirm disabled until chosen
- [ ] Force release / reject / deactivate / reset password confirmed
- [ ] Scanner uses the real scanner; camera stopped on close; permission-denied + manual entry + invalid code states
- [ ] Sheets: Back button, scroll lock, focus trap, Esc, focus return
- [ ] Nav hidden while keyboard is open
- [ ] Live updates (realtime) reflected in list, sheet, requests badge, KPI
- [ ] Offline banner + writes disabled
- [ ] Theme toggle + logout reachable on mobile
- [ ] All insight cards reachable; Manage Users has full parity; Audit has filters + history + CSV
- [ ] Dark mode verified on every screen and sheet
- [ ] No horizontal scroll at 320–767px
- [ ] Lint/build/tests pass; no new console errors