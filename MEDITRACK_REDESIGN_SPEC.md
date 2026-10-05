# MediTrack Redesign Spec

**Audience:** an AI coding agent (Antigravity) implementing the redesign, and the developer reviewing it.
**Target file(s):** `index.html` (about 6,300 lines: roughly 2,400 CSS, 600 markup, 3,300 JS).
**Goal:** make MediTrack look and feel like a premium, trustworthy, production healthcare product, **without changing what it does**.

---

## 0. How to use this document

1. Work in **phases** (Section 9). Finish and verify one phase before starting the next. Do not attempt a full rewrite in one pass.
2. Before touching anything: `git checkout -b redesign` and keep the original `index.html` as a fallback.
3. **Behavior is frozen.** This is a visual and UX redesign. Section 7 lists the contracts (IDs, function names, class hooks) that the JS depends on. Section 8 lists a few behavior and security items that should be fixed separately and flagged in your summary.
4. When something in this spec conflicts with what the code does, the code's behavior wins. Tell the developer about the conflict.

---

## 1. What the product is

MediTrack is a real-time **hospital equipment tracking system**. Staff scan a QR sticker on a piece of equipment (ventilator, infusion pump, wheelchair, defibrillator, monitor) to check it out or release it. Everyone sees live status.

**Stack:** vanilla HTML/CSS/JS, single page, Supabase (Postgres + Realtime), `bcryptjs`, `qrcodejs`, `html5-qrcode`. No build step. Keep it that way.

**Users and roles**

| Role | Can do | Sees |
|---|---|---|
| **Manager** | Everything: add products, print stickers, approve requests, set equipment condition, run weekly AI analysis, manage users | Dashboard, Audit Log, Manage Users |
| **Senior Doctor** | Scan, check out/release, request, approve/reject requests, view AI insights | Dashboard, Audit Log |
| **Staff** | Scan, check out/release, submit requests | Dashboard only |

**Pages:** Login, Dashboard (`#page-dashboard`), Audit Log (`#page-auditlog`), Manage Users (`#page-users`).

**Core domain objects**
- Equipment: name, department, QR id (e.g. `MT-ICU-003`), **status** (`Available` / `In Use`), **condition** (`Usable` / `Needs Maintenance` / `Out of Order`), product type (with image), current room when in use.
- Departments: ICU, General Ward, Emergency, Operation Theatre, Maternity Ward, Radiology.
- Requests: pending access requests with `Normal` or `Urgent` priority.
- Audit log: timestamped actions per item. Times display in Asia/Kolkata.
- AI insights: a daily brief (highlights, attention items, forgotten equipment, rebalancing suggestions) and an on-demand weekly report with progress.

**Where it is used:** a busy hospital. Users are often standing, on a phone, in a hurry, possibly gloved. The most common action is **"what's available right now, and where?"**, followed by **scan, check out, release**. The design must serve that first.

---

## 2. Audit of the current UI

Measured from the uploaded `index.html`:

| Finding | Evidence | Why it matters |
|---|---|---|
| Emoji used as icons everywhere | 24 distinct emoji (🏥📊🔍👤🖨📍🚨🧪🤖…) in markup and JS-built HTML | Render differently per OS, look unprofessional, can't be themed or sized consistently, noisy for screen readers |
| Generic "Google blue" gradient header, login background and buttons | `#1557b0 → #1a73e8 → #0ea5e9` repeated | Reads as a template or prototype, not a healthcare brand |
| No dark mode, no theme control | 0 uses of `prefers-color-scheme` | Night-shift users, and basic modern expectation |
| Heavy inline styling | 137 `style="..."` attributes across markup and JS strings | Impossible to restyle from CSS alone, inconsistent spacing |
| Inconsistent type scale | 10 different pixel sizes, including 9px and 10px text, 41 uses of 13px, 34 of 12px, 31 of 11px | Weak hierarchy, small text hurts readability |
| Too many raw colors | 54 distinct hex values, with a separate color family for every role | Visual noise; roles shouldn't compete with status colors |
| Dense, low-hierarchy dashboard | AI panel, weekly card, stats, product tiles, filters, list, sidebar all compete at the same visual weight | The primary question ("what's available?") isn't the hero |
| Status relies mostly on color | Red/green pills | Fails for color-blind users; "In Use" in alarm-red reads as an error |
| Default credentials printed on the login screen | `Default: admin / NewAdmin@123! …` hint | Must not ship (and it disagrees with the README password) |
| Only 8 `:focus-visible` rules, 2 `prefers-reduced-motion` rules | grep counts | Keyboard and motion accessibility are patchy |
| Tables on mobile | Users table, audit summaries | Likely horizontal scroll or cramped on phones |
| Page-level `overflow-x: hidden` hacks | comments in CSS | Symptom of layout overflow that should be fixed at the source |

What already works and should be **kept**: accordion equipment rows with `aria-expanded`, skip link, `aria-live` regions, skeleton loaders, realtime LIVE badge, 16px inputs on mobile (avoids iOS zoom), print stylesheet for QR stickers.

---

## 3. Design principles

Grounded in widely used guidance: WCAG 2.2 AA, Nielsen's usability heuristics, Apple HIG and Material touch-target sizes, and common healthcare UI practice.

1. **Glanceable first.** The answer to "what's available and where" is visible within 2 seconds on load. Everything else supports it.
2. **Calm and trustworthy.** Quiet neutrals, one confident brand color, generous whitespace. Color is reserved for *meaning* (status, priority), not decoration.
3. **Status is never color-only.** Every status gets an icon and a text label as well as a color. Check this in grayscale.
4. **One-handed, gloved-hand friendly.** Touch targets at least 44×44px on mobile. Primary actions sit in the thumb zone. Mobile uses a bottom tab bar and bottom sheets.
5. **Progressive disclosure.** Rows show name, department, status, room. Details, QR, history and actions appear on expand. AI insights are collapsible and visually secondary.
6. **Clear hierarchy.** One page title, one primary action per region, max 3 text weights, consistent spacing rhythm.
7. **Feedback for every action.** Hover, active, focus, loading, success and error states exist for all interactive elements. Toasts confirm. Long actions show progress.
8. **Accessible by default.** Text contrast at least 4.5:1, UI component and focus contrast at least 3:1, visible focus ring, minimum target 24px (WCAG 2.2) and 44px on touch, full keyboard operation, reduced-motion respected.
9. **Honest empty and error states.** Never a blank panel. Say what's missing and what to do next.
10. **Consistency over cleverness.** Few components, reused everywhere, built from tokens.

---

## 4. Design system

Define everything as CSS custom properties on `:root`, with a dark override. **No hardcoded hex values outside the token block.** Replace the current `--primary`, `--available`, `--inuse`, etc. with the tokens below, keeping old names as aliases temporarily if that makes migration safer, then delete the aliases at the end.

### 4.1 Color tokens

Brand direction: **deep teal on cool, near-white neutrals**. Clinical but warmer than default blue.

```css
:root {
  /* Neutrals */
  --bg:            #F5F7FA;
  --surface:       #FFFFFF;
  --surface-2:     #F0F3F7;   /* subtle fills, table headers, inputs */
  --surface-raised:#FFFFFF;
  --border:        #E3E8EF;
  --border-strong: #CBD3DE;
  --text:          #0F1B2D;
  --text-2:        #4B5A6D;
  --text-muted:    #5A6A7D;   /* 5.5:1 on white; do not go lighter */

  /* Brand */
  --brand:         #0B6E8A;   /* 5.8:1 with white text */
  --brand-hover:   #095A72;
  --brand-soft:    #E3F3F7;
  --brand-ink:     #064559;   /* text on brand-soft */
  --focus-ring:    #0B6E8A;

  /* Status (each has fg, soft bg, border) */
  --ok:        #0F7B4F;  --ok-bg:   #E4F5EC;  --ok-bd:   #A9D9BF;   /* Available, Usable */
  --busy:      #2457C5;  --busy-bg: #E6EEFC;  --busy-bd: #B3C7F2;   /* In Use */
  --warn:      #A15C07;  --warn-bg: #FDF1DC;  --warn-bd: #EBC784;   /* Needs Maintenance, Normal-pending */
  --danger:    #B42318;  --danger-bg:#FDECEA; --danger-bd:#F2B8B2;  /* Out of Order, Urgent, errors */

  /* Elevation */
  --shadow-1: 0 1px 2px rgba(15,27,45,.06), 0 1px 1px rgba(15,27,45,.04);
  --shadow-2: 0 4px 12px rgba(15,27,45,.08), 0 1px 3px rgba(15,27,45,.05);
  --shadow-3: 0 16px 40px rgba(15,27,45,.16), 0 4px 12px rgba(15,27,45,.08);

  /* Shape and motion */
  --r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-pill: 999px;
  --ease: cubic-bezier(.2,.8,.2,1);
  --t-fast: 140ms; --t-base: 220ms; --t-slow: 320ms;
}

:root[data-theme="dark"] {
  --bg:#0B1220; --surface:#121B2C; --surface-2:#18233A; --surface-raised:#1A2640;
  --border:#243250; --border-strong:#33446A;
  --text:#E8EEF7; --text-2:#B3BFD1; --text-muted:#93A1B8;
  --brand:#3FB3D1; --brand-hover:#6CC6DE; --brand-soft:#0F2F3A; --brand-ink:#BDEAF5; --focus-ring:#6CC6DE;
  --ok:#4CC38A;   --ok-bg:#0E2B20;   --ok-bd:#1E5B41;
  --busy:#7AA2F7; --busy-bg:#12213F; --busy-bd:#2A4A8A;
  --warn:#F0B35A; --warn-bg:#2E2210; --warn-bd:#6B4B16;
  --danger:#F28B82; --danger-bg:#34171A; --danger-bd:#7A2E2E;
  --shadow-1: 0 1px 2px rgba(0,0,0,.4);
  --shadow-2: 0 4px 14px rgba(0,0,0,.45);
  --shadow-3: 0 18px 44px rgba(0,0,0,.6);
}
```

**Theme logic:** an inline `<script>` in `<head>` (before CSS paints) reads `localStorage.theme` (`light` / `dark` / absent = system), falls back to `prefers-color-scheme`, and sets `data-theme` on `<html>` to avoid a flash. A toggle in the header cycles light, dark and system. Wrap storage access in try/catch. Also set `<meta name="color-scheme" content="light dark">` and update `<meta name="theme-color">` on change.

> The exact hex values are a starting point. If any pairing fails WCAG AA in practice (check with a contrast tool), adjust the value and keep the intent.

### 4.2 Status mapping (single source of truth)

| State | Token | Icon | Label |
|---|---|---|---|
| Available | `--ok` | check-circle | Available |
| In Use | `--busy` | activity or clock | In Use · {room} |
| Condition: Usable | `--ok` | check | Usable |
| Condition: Needs Maintenance | `--warn` | wrench | Needs Maintenance |
| Condition: Out of Order | `--danger` | x-octagon | Out of Order |
| Request: Normal | neutral | clock | Normal |
| Request: Urgent | `--danger` | alert-triangle | Urgent · needs Sr. Doctor / Manager |

Implement as one `.pill` component with modifier classes (`.pill--ok`, `--busy`, `--warn`, `--danger`, `--neutral`), always containing an icon and text. Replace `.status-pill.available/.inuse` and the condition styles with it.

**Roles are not status.** Render role badges (Manager, Senior Doctor, Staff) as a neutral outlined pill with a small colored dot, not the current purple/cyan/green fills.

### 4.3 Typography

- **Headings and numbers:** `Plus Jakarta Sans` 600/700. **Body and UI:** `Inter` 400/500/600. Load both from Google Fonts with `display=swap`, with system fallbacks. (If keeping one family is preferred, use Inter alone and rely on weight and size.)
- Use `font-variant-numeric: tabular-nums` for stats, timers, durations and QR ids so numbers don't jitter.
- **Scale (px):** 12 (caption, minimum anywhere) · 13 (secondary) · 14 (body) · 16 (inputs on mobile, lead text) · 20 (section title) · 24 (page title) · 32 (KPI numbers).
- **Delete all 9px, 10px and 11px text.** Line height 1.5 body, 1.25 headings. Letter-spacing −0.01em on headings only.
- Uppercase micro-labels only if 12px and `letter-spacing: .04em`.

### 4.4 Spacing, layout, shape

- 4px base unit. Use only: 4, 8, 12, 16, 24, 32, 48, 64.
- Page container: `max-width: 1280px`, side padding 16 (mobile) / 24 (tablet) / 32 (desktop).
- Dashboard grid: main column plus 340px sidebar at ≥1100px; single column below.
- Cards: `--surface`, 1px `--border`, `--r-md`, `--shadow-1`. Hover lift (`--shadow-2`) only on interactive cards.
- Breakpoints: 480, 768, 1100. Design **mobile-first** (base styles = mobile; use `min-width` queries).

### 4.5 Icons

Replace every emoji and Unicode glyph icon (✚ ✓ ⬇ ▲ ▶ ⌃) with **one inline SVG sprite** (`<svg style="display:none"><symbol id="i-…">`) used via `<svg class="icon"><use href="#i-…"/></svg>`. Style: 24px grid, 1.75px stroke, round caps and joins, `currentColor`, rendered at 16 or 20px. Lucide-style shapes, drawn inline (no CDN, no new dependency). Icons that are decorative get `aria-hidden="true"`; icon-only buttons get `aria-label`.

| Current emoji / glyph | Use | Icon |
|---|---|---|
| 🏥 (logo, login and header) | Brand mark | Custom: rounded square with a cross and a small pulse line |
| 📊 Dashboard | Nav | layout-dashboard |
| 🔍 Audit Log | Nav | scroll-text |
| 👤 / 👥 Users | Nav, headings | user / users |
| 🧪 Equipment Dashboard | Section title | boxes |
| 📋 Pending Requests | Panel | clipboard-list |
| 🖨 Print | Buttons | printer |
| 📍 Room / location | Labels | map-pin |
| 🚨 Urgent | Priority | siren or alert-triangle |
| 📷 / 📸 Scan | Scanner | scan-line / camera |
| 🔐 / 🔒 Logout, password | Buttons | log-out / lock |
| 🤖 AI insights | Panel | sparkles |
| 🕑 Items used today | Chips | clock |
| 🟢 In use now | Chips | activity |
| 📄 / 📜 Totals, history | Chips | file-text |
| 📝 Condition | Labels | pencil |
| 🏠 / 🏗 Dept / building | Labels | building-2 |
| 🌞 | Theme | sun / moon / monitor |
| ✚ Add | Buttons | plus |
| ⬇ Export / Download | Buttons | download |
| ▲ ▶ Chevrons | Collapse / expand | chevron-down (rotate via CSS) |

**Product-type tiles** currently use `getPtEmoji()` and optional `images/…` paths. Keep the image support. For the fallback, use a neutral icon on a `--surface-2` tile instead of an emoji.

### 4.6 Motion

- Transitions use `--t-fast`/`--t-base` with `--ease`. Animate only `transform`, `opacity`, `background-color`, `border-color`, `box-shadow`.
- Accordion open/close: animate height via `grid-template-rows: 0fr → 1fr` (no JS height measuring) plus a short fade.
- Modals: fade and scale from 0.98 (desktop), slide up (mobile bottom sheet). Toasts slide and fade.
- LIVE dot: gentle pulse. Skeletons: soft shimmer.
- Whole system: `@media (prefers-reduced-motion: reduce)` disables transforms, shimmer and pulse, leaving instant state changes.
- Press feedback: buttons `transform: translateY(1px)` on `:active`. Never block interaction with animation.

---

## 5. Components

Build these once as CSS classes, then use them everywhere (including the JS-generated HTML). Delete the old one-off classes as you migrate.

| Component | Spec |
|---|---|
| **Button** | Variants: `primary` (brand fill), `secondary` (surface + border), `ghost`, `danger`. Sizes: md (40px desktop / 44px mobile), sm (32px). States: hover, active, `:focus-visible` (2px ring + 2px offset), disabled (50% opacity, no pointer), **loading** (spinner replaces icon, label stays, `aria-busy`). Icon and label gap 8px. |
| **Input / Select / Search** | 44px tall on mobile, 40px desktop, `--surface-2` fill that becomes `--surface` with a brand ring on focus. 16px font on mobile. Label above, helper or error text below (error uses `--danger`, an icon, and `aria-describedby`). Password fields keep the Show/Hide toggle. |
| **Pill / Badge** | See 4.2. Height 24px, 12px/600 text, icon 14px, `--r-pill`. |
| **Card** | See 4.4. Header (title, optional count badge, optional action), body, optional footer. |
| **KPI card** | Icon chip, 32px tabular number, 13px label, optional secondary text (e.g. "62% free"). Clickable KPI sets the status filter. |
| **Segmented control** | For status filter (All / Available / In Use) and theme toggle. Single pill track, sliding or filled active segment, `role="tablist"` or radio group semantics with arrow-key support. |
| **Chip (filter)** | Department filters. Horizontal scroll on mobile (`overflow-x:auto`, snap, hidden scrollbar) with edge fade, not wrapping into 4 rows. |
| **Accordion row** | See 6.2. Keep `button` header + `aria-expanded` + `role="region"` panel. |
| **Modal / sheet** | Overlay with blur and dim. Desktop: centered, max-width 480 (640 for sticker / print / weekly report). Mobile ≤ 600px: bottom sheet with drag-handle affordance, max-height 90dvh, internal scroll. Required: `role="dialog" aria-modal="true" aria-labelledby`, focus moves in on open, **focus trap**, `Esc` closes, focus returns to the trigger, body scroll lock, click on the overlay closes (except while a task is running). |
| **Toast** | Bottom-center on mobile, top-right on desktop. Icon + message + optional close. Success/info use `role="status"`; errors use `role="alert"`. 4s auto-dismiss (6s for errors), pause on hover. Max 3 stacked. |
| **Table → cards** | Users table: real table at ≥768px (sticky header, 56px rows, hover row), stacked cards below with label/value pairs. |
| **Empty state** | Icon in a soft circle, one-line title, one-line help, optional primary action. Needed for: no equipment, no search matches, no requests, no audit entries, no AI insights, no weekly report. |
| **Skeleton** | Match the shape of the real content (row, KPI, card). Keep existing skeleton idea; restyle with tokens and shimmer. |
| **Banner / alert** | Inline conflict alert (scanner), login error, weekly error. Icon + text, `--danger-bg` / `--danger-bd`. |

---

## 6. Screen-by-screen spec

### 6.1 Login
- **Desktop:** two-pane. Left (≈45%): brand panel in deep teal with a subtle radial gradient and faint grid or pulse-line pattern, the logo mark, a short value line ("Know where every device is, right now."), and 3 small points (Live status, QR check-in, Audit trail). Right: form on `--surface`.
- **Mobile:** single column. Compact brand header, form below. No separate panel.
- Form: Username, Password (Show/Hide), full-width primary **Sign in** with loading state, inline error banner (`role="alert"`, shake-free, brief fade). `Enter` submits.
- **Remove the "Default: admin / …" hint entirely.** Footer: small muted text like "Authorized hospital staff only".
- Theme toggle top-right.

### 6.2 App shell
- **Header (desktop):** sticky, `--surface` with bottom border and slight blur (not a loud gradient). Left: logo mark + "MediTrack" (with the small subtitle only at ≥1100px). Center: nav as pill tabs with icon + label, active = `--brand-soft` background with `--brand-ink` text. Right: LIVE indicator (dot + "Live", with a tooltip), theme toggle, **user menu** (avatar initials circle, name, role badge; popover with "Sign out").
- **Mobile (<768px):** slim top bar (logo, LIVE, theme, avatar menu) plus a **fixed bottom tab bar** for the role's pages (icon over label, 56px, safe-area inset padding). Add bottom padding to the page so content isn't hidden.
- Nav is still built by `buildNav()` from the role. Do not change which tabs each role sees.
- Keep the skip link and visible focus.

### 6.3 Dashboard
Top to bottom:

1. **Page header:** title "Equipment", today's date, and the primary actions to the right: **Scan QR** (primary, always visible, becomes a floating action button on mobile), plus **Add Product** (Manager only). Scan QR currently lives in the equipment toolbar (`.scan-btn`, calls `openScanner()`). Move it up here and keep the same handler.
2. **KPI row:** Total, Available, In Use (`#stat-total`, `#stat-available`, `#stat-inuse`). Optionally add Needs Attention if it can be derived from existing loaded data without new queries. Cards on a 3-column grid (stacked 1-column on very small screens is fine; 3 compact cards across fits at 375px with smaller padding).
3. **AI Insights (Manager and Senior Doctor):** collapsible card with a sparkles icon and a "Daily brief" title, **collapsed by default on mobile**. Brief card: headline, short summary, highlights as a clean list, attention items as warn-colored chips. Forgotten and Rebalancing cards in a responsive grid (1 / 2 / 3 columns) with consistent card anatomy (icon chip, title, body, footer). Weekly report card (Manager): status line, **Run weekly analysis** primary-small button, countdown, progress bar (`role="progressbar"` with values), "View report" secondary button. Visually quieter than the equipment list (no colored left borders; use a subtle icon chip instead).
4. **Equipment section:**
   - **Product-type tiles:** a clean grid of image tiles (rounded 12px, image on `--surface-2`, name, count badge, selected state with brand ring). Collapsible. Show a "Clear filter" chip in the breadcrumb (`#product-breadcrumb`) when active.
   - **Toolbar:** search (with icon, clear button), status segmented control (wires to `setFilter`), department chips (rendered into `#dept-filter-group`), Print All QR as a secondary button. On mobile: search on its own row, segmented control full width, chips scroll horizontally.
   - **List:** accordion rows (`buildEqRow`). **Collapsed row:** name (600), department tag, status pill (with room when In Use), live duration (tabular numerals) if in use, chevron. Row height at least 56px, 64px on mobile. **Expanded panel:** two columns on desktop (details and actions left, QR code right), stacked on mobile. Group related facts in a definition list: QR id, department, condition (pill), current room, held-for duration, last action. Actions row: **Check out / Release** (primary), **Request access** (secondary, when applicable), **Print sticker** (ghost, Manager). Manager condition editor: select + Save, inline.
   - Empty state when filters match nothing, with a "Clear filters" action.
5. **Sidebar (≥1100px) / below list (smaller):**
   - **Pending requests** panel: each request is a mini card with equipment name, requester, relative time, priority pill. Approve (primary-sm) and Reject (ghost-danger-sm) only for Manager and Senior Doctor, otherwise the existing "awaiting approval" message as muted text. Empty state. The "jump to requests" chip (`#jump-requests`) stays and should scroll and focus the panel.
   - **Audit log link** panel (not Staff): simple card with a link button.

### 6.4 Audit Log
- Page header with title and **Export CSV** (secondary, download icon).
- Filters toolbar: search, department select, date select, action select. Inline row on desktop, collapsible "Filters" disclosure on mobile with an active-filter count.
- Summary chips: total events, items used today, in use now (tabular numbers).
- Equipment list with expandable **timeline**: vertical line, colored dot per action type (`getDotClass`) with an icon, action, user, relative and absolute time. "Load more" as a secondary button with a loading state. Empty state.

### 6.5 Manage Users (Manager only)
- Two-column grid at ≥900px (create form left, users list right), single column below.
- Create user card: username, role, department. After creation, show the **temporary password in a distinct box with a Copy button** and the one-time warning ("Shown once. Share securely.").
- Users list: table at ≥768px, cards below. Role badge (neutral outlined), department, status pill (Active / Inactive), actions (Reset password, Deactivate or Reactivate) as icon buttons with labels and tooltips. Destructive actions (deactivate) should ask for confirmation using the modal pattern if they don't already.

### 6.6 Modals
Apply the modal pattern from Section 5 to all eight: `#scanner-modal`, `#room-picker-modal`, `#request-modal`, `#reset-pw-modal`, `#add-equipment-modal`, `#sticker-modal`, `#print-all-modal`, `#weekly-report-modal`.
- **Scanner:** camera viewport with rounded corners and corner-bracket overlay, clear permission/error state, manual-entry fallback below (`#manual-qr`), conflict alert as a prominent banner, result as a success or error card with an icon.
- **Request:** priority as a two-option segmented radio (Normal / Urgent) that keeps `role="radio"` and `aria-checked`.
- **Reset password:** make the field a password input with a Show toggle (it is currently `type="text"`).
- **Sticker and Print-all:** the on-screen preview can be restyled. **The printed sticker layout and `@media print` rules must remain visually unchanged** apart from using the new font and tokens, because stickers are physical, scannable labels. Test a QR scan from a printed or on-screen sticker after changes.
- **Weekly report:** readable long-form layout, max-width 720, comfortable line length, section headings, history select as a compact dropdown, Download Markdown as a secondary button.

### 6.7 Global states
- **Loading:** skeletons matching real shapes. **Error:** inline banner with Retry where a fetch failed. **Offline/realtime lost:** LIVE indicator turns neutral/warn ("Reconnecting…") if the subscription drops, if the existing code exposes that state. If it does not, skip it and mention it in the summary.
- **Focus:** one global `:focus-visible` style (`outline: 2px solid var(--focus-ring); outline-offset: 2px`), never `outline: none` without a replacement.

---

## 7. Behavior contracts (do not break)

The JS is tightly coupled to the DOM. **Before renaming or removing anything, grep for it.**

1. **Preserve every existing element `id`** used by `getElementById` / `querySelector` (the full list is in the markup: `login-*`, `header-*`, `page-*`, `nav-*`, `stat-*`, `eq-*`, `filter-*`, `audit-*`, `new-*`, `reset-pw-*`, `room-picker-*`, `sticker-*`, `print-all-*`, `weekly-*`, `ai-*`, `req-*`, `toast-container`, and so on). If a new layout needs a different structure, keep the id on the equivalent element.
2. **Preserve the inline-handler function names** called from `onclick`, `oninput`, `onchange`, `onkeydown` (56 `onclick` handlers, for example `doLogin`, `doLogout`, `setFilter`, `setDeptFilter`, `openScanner`, `submitManualQr`, `selectPriority`, `submitRequest`, `createUser`, `openAddEquipmentModal`, `createEquipment`, `openPrintAllModal`, `requestWeeklyAnalysis`, `openWeeklyModal`, `exportAuditCSV`, `togglePasswordVisibility`, `jumpToRequests`, `toggleTilesCollapse`, `toggleAiInsights`). You may switch to `addEventListener`, but only if behavior is identical.
3. **Class hooks the JS toggles:** `.page-view` + `.active`, `.nav-tab` + `.active`, `.eq-row` + `.open`, `.login-error` + `.show`, `.modal-overlay` (shown by setting `style.display`), `.filter-btn` + `.active`, `.priority-option.selected-*`, product-tile selected state. Either keep these class names or update the JS that sets them, in the same change.
4. **JS builds a lot of HTML with inline `style=` and emoji** (`buildEqRow`, `buildExpandedHTML`, `renderRequests`, `buildBriefCard`, `buildForgottenCard`, `buildRebalancingCard`, `renderAuditTimeline`, `loadUsersTable`, `renderProductTiles`, the sticker and print functions, `showToast`). **CSS alone will not finish the redesign. Edit those string templates too**, replacing inline styles with classes and emoji with icon symbols.
5. **Role gating stays exactly as is:** Add Product, Run Weekly, and weekly card (Manager); Audit Log nav and sidebar link (Manager + Senior Doctor); Manage Users (Manager); Approve/Reject (Manager + Senior Doctor); Condition editor (Manager).
6. **Keep:** Supabase queries and realtime subscription, bcrypt login flow, session handling, QR generation and scanning, CSV export, timer logic, pagination, the `esc()` HTML-escaping on user data. Always keep `esc()` on any new template interpolation.
7. Keep it **one deployable static site with no build step.** Optionally split into `index.html` + `styles.css` + `app.js` as a mechanical, behavior-free Phase 0 (it makes the work easier to review). Relative paths must still work when served by any static host.

---

## 8. Things to fix or flag (separate from the visual work)

These came up during the audit. Fix the UI-adjacent ones; **report the rest to the developer and don't silently re-architect.**

| # | Item | Action |
|---|---|---|
| 1 | Default credentials printed on the login screen | **Remove** (UI task) |
| 2 | README says `Admin@1234`, login hint says `NewAdmin@123!` | Remove the hint; developer to align README and **change the admin password before deploying** |
| 3 | Reset-password input is `type="text"` | Change to password + Show toggle (UI task) |
| 4 | Auth is client-side: bcrypt in the browser, session in `sessionStorage`, RLS configured for anonymous access, Supabase anon key in the page | **Not a UI fix.** For a real deployment this means anyone with the URL and key can read and write the database. Flag prominently. Recommended path: Supabase Auth or an Edge Function for login, and real RLS policies by role |
| 5 | Timestamps: `parseUtcFe` appends `Z` to timestamps with no timezone and `toLocalDateKolkata` formats in Asia/Kolkata | Looks correct on read. Spot-check a few audit entries against the database values and leave the logic alone unless something is off |
| 6 | CSV export: `csvCell` quotes commas and quotes but does **not** neutralize cells that start with `=`, `+`, `-` or `@` (spreadsheet formula injection) | Fix: prefix such values with a single quote (`'`) before quoting. Small, safe change |
| 7 | CDN scripts are unpinned or from several hosts (`supabase-js@2`, unpkg, cdnjs, jsdelivr) | Pin exact versions; add `integrity` + `crossorigin` (SRI) where available; add `defer` where safe |
| 8 | Camera scanning needs **HTTPS** (browsers block `getUserMedia` on plain HTTP except localhost) | Note in deployment checklist |
| 9 | A native `confirm()` is used in `requestWeeklyAnalysis` ("Run Weekly Deep Analysis?") | Replace with the modal pattern, keeping the same message and the same cancel/continue behavior |

---

## 9. Implementation phases

Verify each phase in the browser before starting the next. Commit after each.

| Phase | Scope | Done when |
|---|---|---|
| **0. Safety net** | Branch, backup, optional file split. No visual change. | App behaves identically |
| **1. Foundations** | Token block (light + dark), theme script + toggle, font loading, base reset, type scale, global focus style, reduced-motion block, icon sprite | Old UI still works but picks up new fonts, colors, dark mode |
| **2. Shell** | Login (6.1), header and mobile tab bar (6.2), user menu | Login and navigation done on all 3 roles |
| **3. Core components** | Buttons, inputs, pills, cards, segmented control, chips, toast, empty states, skeletons (Section 5) | Components exist and are used by shell |
| **4. Dashboard** | KPI, equipment toolbar, rows and expanded panel, tiles, sidebar requests, AI insights and weekly card (6.3) including JS template edits | Dashboard fully migrated; no emoji or inline styles left in it |
| **5. Modals** | All eight modals (6.6), focus trap, bottom sheets, scanner restyle | Modals pass keyboard test |
| **6. Audit and Users** | 6.4 and 6.5 | Both pages migrated, tables become cards on mobile |
| **7. Cleanup and polish** | Delete dead CSS and old color aliases, remove remaining inline styles, fix overflow at source (remove the `overflow-x:hidden` hacks), print check, Section 8 items, pre-deploy checklist | Checklist in Section 10 passes |

Within each phase, finish markup, CSS and the JS template strings for the same component together so nothing is half-migrated.

---

## 10. Acceptance checklist

**Per role (Manager, Senior Doctor, Staff), in light and dark:**
- [ ] Login, logout, role-correct nav and page access
- [ ] Equipment list loads, filters (status, department, product, search) work, accordion opens and closes
- [ ] Scan flow, manual QR entry, conflict alert, room picker, check-out and release
- [ ] Request, approve and reject (and the Staff "awaiting approval" state)
- [ ] Realtime update appears in a second window without refresh
- [ ] Audit log filters, timeline, load more, CSV export
- [ ] Manager: add product and sticker, print all, condition save, create user and temp password, reset password, deactivate, weekly analysis and report

**Visual and responsive:**
- [ ] Looks right at **360, 390, 768, 1024, 1440** px wide; no horizontal page scroll at any width
- [ ] Mobile has a bottom tab bar, bottom-sheet modals, and 44px minimum touch targets
- [ ] No emoji icons remain; no `font-size` under 12px; no hex colors outside the token block; no leftover inline `style=` except truly dynamic values (e.g. progress width)
- [ ] Every status shows icon + text, not just color (check in grayscale)

**Accessibility:**
- [ ] Full keyboard operation, visible focus everywhere, logical tab order, modal focus trap and return focus
- [ ] Text contrast at least 4.5:1, UI and focus contrast at least 3:1 in both themes
- [ ] `prefers-reduced-motion` respected; `aria-live` regions still announce updates; icon-only buttons labeled
- [ ] Lighthouse Accessibility at least 95, Best Practices at least 90, Performance at least 85 on mobile

**Print:** QR stickers print as before and **still scan**.

---

## 11. Pre-deployment checklist (non-visual)

- [ ] `<title>`, meta description, `theme-color`, `color-scheme`, Open Graph and Twitter tags
- [ ] Favicon (inline SVG data-URI of the logo mark) and `apple-touch-icon`; optionally a web manifest so the app can be added to a phone's home screen
- [ ] `lang="en"` kept; one `<h1>` per view
- [ ] Pinned CDN versions with SRI; fonts preconnected; consider self-hosting fonts and libraries for reliability
- [ ] **Serve over HTTPS** (needed for the camera). Static hosts such as Netlify, Vercel, Cloudflare Pages or GitHub Pages work
- [ ] Change the default admin password; resolve Section 8 item 4 (real auth and RLS) before real patient-facing or hospital use
- [ ] Remove `.idea/`, `.vscode/`, `script_test.js` from the deployed bundle if they aren't needed

---

## 12. Kickoff prompt for Antigravity

Paste this as the first message, with this file attached:

```
Read MEDITRACK_REDESIGN_SPEC.md fully, then read index.html.

Implement the redesign in the phases defined in Section 9, one phase at a time.
Rules:
- Behavior is frozen. Obey Section 7 (IDs, inline-handler function names, class hooks, role gating).
- Edit the JS-generated HTML strings as well as the CSS (Section 7, item 4).
- Start with Phase 0 and Phase 1 only. When done, stop and give me: what you changed, how to verify it, and anything in the spec that conflicted with the code.
- Do not start the next phase until I say "continue".
- Report the Section 8 items you could not fix instead of silently changing architecture.
```

After each phase, ask it to run through the matching items in Section 10 and report results.
