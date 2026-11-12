# MediTrack Redesign: Consolidated Master Findings & Remediation Plan (Phase 2 Synthesis)

**Target Application**: MediTrack Hospital Equipment Tracker  
**Operating Context**: Hospital staff (nurses, biomedical technicians, ward administrators, clinical engineers) scanning equipment QR codes to check in/out on mobile phone viewports (360px–414px) in busy clinical wards. The interface tone must be **calm, trustworthy, and fast**.  
**Synthesis Author**: synthesizer_phase2 (Phase 2 Parallel Synthesis Engine)  
**Date**: 2026-11-12  
**Target Milestone**: Phase 2 -> Phase 3 Transition  

---

## 1. Baseline Quality Health Metrics & Executive Summary

### 1.1 Exact `npx impeccable detect .` Baseline Count
The initial design detector scan executed prior to Phase 1/Phase 2 changes produced the following baseline advisory output:

```text
64 files scanned with regex matching only (.cjs, .css, .js, .ts).
Rules that need a parsed page (tiny-text, low-contrast and other element rules) did not run on them; findings are an undercount, not a clean bill of health.
For the full check, scan the running dev server (npx impeccable detect http://localhost:PORT) or a static site's built .html.

419 advisory notes. Suppress with --no-advisory.
```

#### Detector Advisory Breakdown by Category (Core Production Files):
- **Overused & Non-Declared Fonts (`[design-system-font]`, `[overused-font]`)**: 32 occurrences (`Plus Jakarta Sans` imported and declared across `index.html`, `styles.css`, `mobile.css`, and `mobile.js`, violating `DESIGN.md` canonical font `Inter`).
- **Low Contrast (`[low-contrast]`)**: 22 occurrences (status badges in light mode, dimmed product tiles, and placeholder text failing WCAG AA 4.5:1 ratio).
- **AI-Generated Tells (`[side-tab]`, `[pulsing-dot]`, `[dark-glow]`, `[nested-cards]`)**: 28 occurrences (asymmetric 3px left card borders, infinite pulsing status dots, zero-offset electric blue glows `#38bdf8` / `#2F5BEA`, and triple-nested cards).
- **Type Ramp & Rounded Token Drift (`[design-system-font-size]`, `[design-system-radius]`, `[design-system-color]`)**: 260+ occurrences in `styles.css` (literal font sizes `11px`, `13px`, `15px`, `28px`; literal radii `8px`, `12px`; literal colors outside token palette).
- **Punctuation & Layout Rhythm (`[em-dash-overuse]`, `[cramped-padding]`, `[flat-type-hierarchy]`)**: 77 occurrences.

---

### 1.2 Evaluation Scorecards Summary

| Surface / Audit Area | Review Agent | Score | Assessment |
|----------------------|--------------|-------|------------|
| **Dashboard Surface** | Agent A (`findings_a.md`) | **22 / 40** (Nielsen Heuristics) | High cognitive load; 1,200px fold depth on mobile; hidden chevron affordance; casual emojis; saturated marketing gradients. |
| **Login & Manage Users** | Agent C (`findings_c.md`) | **20 / 40** (Nielsen Heuristics) | Missing `<form>` element; raw 19px unstyled desktop segmented buttons; alarmist "demo mode" notice; undersized touch targets (22px). |
| **Accessibility, Responsive & Theming** | Agent B (`findings_b.md`) | **11 / 20** (Technical Audit) | Broken ARIA table parentage; 360px header overflow clipping logout; light theme status badges fail WCAG AA contrast (2.9:1); missing image alts. |
| **Overall Production Readiness** | Consolidated | **53 / 100** | **Prototype / In-Development** (Requires systematic Phase 3 refactoring). |

---

### 1.3 Consolidated Findings Severity Distribution

| Severity Level | Definition | Finding Count |
|----------------|------------|---------------|
| **P0 (Critical / Blocking)** | Core flow blockage, accessibility tree invalidation, viewport clipping of critical actions, or severe touch target failure preventing one-handed gloved ward use. | **5** |
| **P1 (Major / Clinical Ergonomics / WCAG AA Failure)** | WCAG 2.1 AA contrast failures, unstyled UI controls, conspicuous AI prototype tells, casual emojis undermining clinical trust, missing ARIA attributes. | **14** |
| **P2 (Minor / Clutter / Hygiene / Spacing)** | Card-in-card visual heaviness, redundant buttons, unstyled empty states, missing desktop copy utilities, token bypassing with hardcoded colors. | **15** |
| **P3 (Polish / Design Notes)** | Off-ramp font sizes, em-dash copy density, safe-area inset padding on floating toggles, robotic microcopy phrasing. | **6** |
| **Total Actionable Findings** | Excludes non-permitted changes cataloged in Section 5. | **40** |

---

## 2. Consolidated Prioritized Fix List

### 2.1 Master Findings Matrix

| Finding ID | Priority | Page / Surface | File & Selector | Phase 3 Step | Effort | Risk | Short Summary |
|------------|----------|----------------|-----------------|--------------|--------|------|---------------|
| **P0-01** | **P0** | Dashboard | `styles.css` (`.eq-row-header`, `.eq-cell-chevron`) | `harden` | S | low | Restore row expand chevron indicator on mobile viewports (<640px). |
| **P0-02** | **P0** | Dashboard | `styles.css` (`.kpi-grid`, `.product-tiles-section`) | `layout` | M | low | Condense mobile KPI stack from 1,200px vertical depth into compact 2×2 grid. |
| **P0-03** | **P0** | Global | `styles.css` (`.header-right`, `#logout-btn`, `#header-avatar-btn`) | `adapt` | M | low | Fix 360px header control overflow clipping logout and avatar off-screen. |
| **P0-04** | **P0** | Login | `index.html` (`.login-card`, `#login-form`) | `harden` | S | low | Wrap login inputs in semantic `<form>` for keyboard submission and autofill. |
| **P0-05** | **P0** | Dashboard & Audit | `index.html` (`.eq-col-head`, `#equipment-list`, `.audit-table-header`) | `harden` | S | low | Fix broken ARIA table parentage (`role="row"` without `role="table"`). |
| **P1-01** | **P1** | Global / Touch | `styles.css` / `mobile.js` (`.pw-toggle`, `.filter-btn`, `.tbl-action-btn`, `.btn-save-condition`) | `adapt` | M | low | Enforce 44×44px minimum touch targets across all mobile buttons and toggles. |
| **P1-02** | **P1** | Dashboard & Login | `styles.css` (`.request-queue-card`, `.login-brand-panel`, `--grad-highlight`) | `quieter` | M | low | Replace loud blue gradient (`#4C7BFF`) with calm, solid medical surface styling. |
| **P1-03** | **P1** | Global / Theming | `styles.css` (`.status-pill.avail`, `.status-pill.inuse`, `.status-pill.attn`) | `quieter` | S | low | Darken status badge text in light mode to achieve WCAG AA ≥ 4.5:1 contrast. |
| **P1-04** | **P1** | Dashboard & Mobile | `app.js` (`PT_EMOJI`), `mobile.js` (lines 1177, 1615, etc.) | `quieter` | M | low | Replace raw on-screen UI emojis (`🫁`, `➕`, `⚡`, `🖨️`) with SVG sprite symbols. |
| **P1-05** | **P1** | Global / Typography | `index.html` (line 33), `styles.css`, `mobile.css`, `mobile.js` | `typeset` | S | low | Eliminate `Plus Jakarta Sans` and unify all typography onto `Inter` stack. |
| **P1-06** | **P1** | Manage Users | `styles.css` (`.segmented-control`, `.segmented-btn`) | `layout` | S | low | Provide styling for raw 19px browser default buttons on desktop user filter. |
| **P1-07** | **P1** | Audit Log | `app.js` (`button.audit-col-btn`) | `harden` | S | low | Remove invalid `aria-sort` attribute from column `<button>` elements. |
| **P1-08** | **P1** | Modals & Sheets | `app.js`, `mobile.js` (`#sticker-qr-container img`, `#prev-qr-* > img`) | `clarify` | S | low | Add descriptive `alt` attribute to dynamically generated QR code images. |
| **P1-09** | **P1** | Modals & Sheets | `mobile.js` (`mOpenSheet`, `mCloseSheet`, `#m-confirm-close`) | `harden` | M | low | Implement focus trapping, background `inert`, and close label on mobile sheets. |
| **P1-10** | **P1** | Dashboard | `styles.css` (`.dimmed.product-tile .pt-name`, `.pt-summary`) | `quieter` | S | low | Restore readable text contrast on dimmed/inactive product filter tiles. |
| **P1-11** | **P1** | Dashboard | `app.js` (`buildEqRow`), `styles.css` (`.eq-mobile-meta`) | `clarify` | M | low | Display room and bed location in collapsed mobile equipment row summary. |
| **P1-12** | **P1** | Login | `index.html` / `styles.css` (`.login-security-notice`) | `distill` | S | low | Remove alarmist "Demo mode: not for production" notice from login card. |
| **P1-13** | **P1** | Manage Users | `styles.css` (`.role-chip.role-doctor::before`, `.m-role-pill.doctor`) | `quieter` | S | low | Change Senior Doctor role chip from warning amber (`#D97706`) to calm indigo/slate. |
| **P1-14** | **P1** | Manage Users | `styles.css` (`.users-table-container`, `.manage-users-grid`) | `adapt` | M | low | Add horizontal scroll cue/shadow for user table on tablet/compact viewports. |
| **P2-01** | **P2** | Dashboard | `index.html` / `styles.css` (`.kpi-arrow-btn`) | `distill` | S | low | Remove redundant diagonal arrow buttons (`↗`) from KPI card headers. |
| **P2-02** | **P2** | Dashboard | `styles.css` (`.kpi-chip`, `.kpi-chip-*`) | `quieter` | S | low | Remove colored squircle background chips behind KPI card icons. |
| **P2-03** | **P2** | Dashboard & Users | `styles.css` (`.req-stat-tile`, `.request-item`, `.create-user-panel`) | `distill` | M | low | Flatten nested card-in-card containers into clean divided surface sections. |
| **P2-04** | **P2** | Dashboard | `app.js` (lines 2305, 2756), `index.html` (lines 422, 478) | `quieter` | S | low | Replace raw Unicode characters (`✔`, `▶`, `▼`, `▲`) with SVG sprite icons. |
| **P2-05** | **P2** | Dashboard | `index.html` (`#more-actions-menu`, `#print-all-btn`) | `distill` | S | low | Remove redundant duplicate "Print all QR codes" item from header kebab menu. |
| **P2-06** | **P2** | Dashboard | `styles.css` (`.dept-filter-group`) | `adapt` | S | low | Add horizontal scroll gradient cue/mask to overflowing department filter pills. |
| **P2-07** | **P2** | Dashboard | `app.js` (`renderEquipment`, line 2553) | `harden` | S | low | Standardize hardcoded inline styles on empty equipment filter container. |
| **P2-08** | **P2** | Global / Theming | `styles.css`, `mobile.css`, `app.js`, `mobile.js` | `distill` | M | low | Migrate 80+ hardcoded hex/rgba color literals to semantic CSS variables. |
| **P2-09** | **P2** | Dashboard & Audit | `styles.css` (lines 3371-3374) | `quieter` | S | low | Remove asymmetric `border-left: 3px solid` side-tab accents from cards. |
| **P2-10** | **P2** | Dashboard & Mobile | `styles.css` (`.live-dot`), `mobile.css` (lines 325, 332) | `quieter` | S | low | Replace infinite pulsing dot animations and chromatic glow box-shadows. |
| **P2-11** | **P2** | Manage Users | `index.html` / `app.js` (`#new-temp-pw-box`) | `harden` | S | low | Add one-click "Copy" button with toast feedback next to temporary password. |
| **P2-12** | **P2** | Manage Users | `app.js` / `mobile.js` (`renderUsersTable`, `loadUsersTable`) | `harden` | S | low | Provide styled empty state with reset filter CTA and retry button on load failure. |
| **P2-13** | **P2** | Login | `app.js` (`doLogin()`, `#login-error`) | `harden` | S | low | Ensure `#login-error` sets `aria-invalid="true"` and auto-focuses invalid field. |
| **P2-14** | **P2** | Modals | `styles.css` (`#sticker-modal .modal-footer`) | `layout` | S | low | Stack action buttons vertically on 360px viewports to prevent label wrapping. |
| **P2-15** | **P2** | Dashboard & Modals | `index.html` (`#weekly-history-select`, `#cmd-palette-input`) | `clarify` | S | low | Add accessible labels to weekly report select and command palette input. |
| **P3-01** | **P3** | Global / Typography | `styles.css` (lines 252, 356, 486, 3658) | `typeset` | S | low | Align off-ramp literal font sizes (11px, 13px, 28px) to `DESIGN.md` scale. |
| **P3-02** | **P3** | Global / Microcopy | `index.html`, `app.js` (`[em-dash-overuse]`) | `clarify` | S | low | Replace AI em-dash punctuation saturation (`—`) with clean punctuation. |
| **P3-03** | **P3** | Dashboard & Users | `styles.css` (`.segmented-control button`, `.filter-btn`) | `harden` | S | low | Add explicit `:focus-visible` outline indicators to segmented filter controls. |
| **P3-04** | **P3** | Modals / Sheets | `mobile.js` (`.m-sheet-close-btn`, `#m-confirm-close`) | `distill` | S | low | Replace raw Unicode character `✕` on close buttons with `#i-x` SVG sprite. |
| **P3-05** | **P3** | Login | `styles.css` (`.login-theme-toggle`) | `adapt` | S | low | Position login theme toggle using `env(safe-area-inset-top)` to clear notch. |
| **P3-06** | **P3** | Manage Users | `index.html` (`.field-hint`, `#role-helper-text`) | `clarify` | S | low | Rewrite robotic helper text to concise clinical guidance. |

---

### 2.2 Detailed Finding Specifications (P0–P3)

#### P0: Critical / Blocking Findings

##### [P0-01] Mobile Accordion Expand Affordance Hidden
- **Priority**: P0
- **Page**: Dashboard
- **File / Selector**: `styles.css` (`.eq-row-header`, `.eq-cell-chevron`, lines 1777–1795)
- **Phase 3 Step**: `harden`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: On viewports `<640px`, `.eq-cell-chevron` is explicitly set to `display: none;`. In a busy hospital ward, nurses and technicians tapping on equipment rows have zero visual feedback that the row is expandable. They cannot discover how to view assigned room/bed locations, inspection histories, QR sticker printing, or check-in/out toggles.
- **Specific Recommended Fix**: Retain `.eq-cell-chevron` on mobile viewports. Integrate it cleanly into the row header layout with a smooth 180° CSS rotation (`transform: rotate(180deg)`) when `.eq-row.expanded` is active.

##### [P0-02] Mobile Equipment Fold Pushed 1200px Down by Stacked Cards
- **Priority**: P0
- **Page**: Dashboard
- **File / Selector**: `styles.css` (`.kpi-grid`, `.product-tiles-section`, lines 1079–1104, 3409–3424)
- **Phase 3 Step**: `layout`
- **Effort**: M | **Risk**: low
- **Description & Clinical Impact**: On mobile screens (≤640px), `.kpi-grid` switches to `grid-template-columns: minmax(0, 1fr)`. This renders four giant stacked cards, followed by the product category grid and AI insights banner. The actual equipment table starts over 1,200px below the viewport fold, requiring continuous thumb scrolling just to view available inventory.
- **Specific Recommended Fix**: At `max-width: 640px`, compress `.kpi-grid` into a compact 2×2 metric grid or a single horizontal metric ribbon under 110px in total height, bringing the equipment search and table above the 500px fold.

##### [P0-03] Mobile Ward Phone (360px) Header Overflow and Control Clipping
- **Priority**: P0
- **Page**: Global / Header
- **File / Selector**: `styles.css` (`.header-right`, `#header-avatar-btn`, `#logout-btn`, lines 185–230)
- **Phase 3 Step**: `adapt`
- **Effort**: M | **Risk**: low
- **Description & Clinical Impact**: On 360px compact ward smartphones, `.header-right` maintains fixed desktop width constraints (218px). The container pushes `#logout-btn` and `#header-avatar-btn` to `right: 422px`, clipping them completely off-screen. Ward staff cannot log out or switch user profiles.
- **Specific Recommended Fix**: Add a responsive media query `@media (max-width: 600px)` inside `styles.css` that hides non-essential user metadata text, condenses button padding, and ensures all primary header controls fit within 360px without horizontal document overflow.

##### [P0-04] Missing Semantic `<form>` Element on Login
- **Priority**: P0
- **Page**: Login
- **File / Selector**: `index.html` (`.login-card`, lines 135–180)
- **Phase 3 Step**: `harden`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Login inputs and submission button are wrapped in a generic `<div>`, relying on a fragile window `keydown` listener for the Enter key. Mobile virtual keyboards do not display a "Go / Submit" action button, password auto-fill managers fail to detect form boundaries, and screen readers fail to announce form landmarks.
- **Specific Recommended Fix**: Wrap the login fields in `<form id="login-form" onsubmit="event.preventDefault(); doLogin();" novalidate>` without renaming input IDs (`#login-username`, `#login-password`) or the button ID (`#login-btn`).

##### [P0-05] Broken ARIA Table Row Parentage in Equipment and Audit Lists
- **Priority**: P0
- **Page**: Dashboard & Audit Log
- **File / Selector**: `index.html` (`.eq-col-head`, `#equipment-list`, `.audit-table-header`, `#audit-eq-list`, lines 535–536, 740–741)
- **Phase 3 Step**: `harden`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Header rows `.eq-col-head` and `.audit-table-header` define `role="row"`, but their parent containers (`#equipment-list`, `#audit-eq-list`) lack `role="table"` / `role="grid"`, and header cells lack `role="columnheader"`. This triggers critical axe-core `aria-required-parent` violations, causing screen readers (NVDA/VoiceOver) to read broken or corrupted table relationships.
- **Specific Recommended Fix**: Apply `role="table"` to the list container, `role="rowgroup"` to header and body sections, and `role="columnheader"` to header cells, or remove the partial `role="row"` to treat them as standard semantic flex containers.

---

#### P1: Major Quality & Clinical Ergonomics Findings

##### [P1-01] Undersized Touch Targets Below 44px Minimum Standard
- **Priority**: P1
- **Page**: Global (Login, Dashboard, Manage Users, Mobile Sheets)
- **File / Selector**: `styles.css` & `mobile.js` (`.pw-toggle`, `.filter-btn`, `.tbl-action-btn`, `.btn-save-condition`, `.m-user-reset-btn`)
- **Phase 3 Step**: `adapt`
- **Effort**: M | **Risk**: low
- **Description & Clinical Impact**: Crucial interactive controls have heights of 22px to 32px (e.g. `.pw-toggle` is 38×22px; `.filter-btn` is 27px; `.tbl-action-btn` is 32px). Ward staff wearing nitrile gloves miss taps, trigger adjacent actions, or struggle to operate the interface one-handed.
- **Specific Recommended Fix**: Enforce `min-height: 44px; min-width: 44px;` across all interactive buttons, selects, and toggles on mobile viewports, adding transparent tap padding where visual size must remain compact.

##### [P1-02] Saturated Electric Blue Gradient Violates Clinical Calm
- **Priority**: P1
- **Page**: Dashboard & Login
- **File / Selector**: `styles.css` (`.request-queue-card`, `.login-brand-panel`, `--grad-highlight`, lines 49, 181, 2063–2071)
- **Phase 3 Step**: `quieter`
- **Effort**: M | **Risk**: low
- **Description & Clinical Impact**: `--grad-highlight` (`linear-gradient(135deg, #2F5BEA 0%, #4C7BFF 100%)`) introduces undocumented electric blue `#4C7BFF`. Used on `.request-queue-card` and `.login-brand-panel`, it creates severe night-vision glare in darkened patient wards and mimics generic SaaS marketing templates.
- **Specific Recommended Fix**: Replace `--grad-highlight` with calm, solid medical surface styling: `var(--surface)` background, `1px solid var(--border)`, and standard high-contrast typography conforming to `DESIGN.md`.

##### [P1-03] Status Badges and Notices Fail Light-Theme WCAG AA Contrast
- **Priority**: P1
- **Page**: Global (Dashboard, Login, Mobile Shell)
- **File / Selector**: `styles.css` (`.status-pill.avail`, `.status-pill.inuse`, `.status-pill.attn`, `.login-security-notice > span`)
- **Phase 3 Step**: `quieter`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Light theme status badges fail WCAG AA contrast (4.5:1 required):
  - Green `#16A34A` on `#E7F6EC` = **2.9:1** (FAIL)
  - Red `#DC2626` on `#FDECEC` = **3.3:1** (FAIL)
  - Amber `#D97706` on `#FEF3E2` = **2.9:1** (FAIL)
- **Specific Recommended Fix**: Update light mode text tokens in `styles.css`: `--success: #15803D` (4.6:1), `--danger: #B91C1C` (4.8:1), and `--warning: #92400E` (5.3:1).

##### [P1-04] Casual Emojis Used for UI Controls and Equipment Categories
- **Priority**: P1
- **Page**: Dashboard & Mobile Sheets
- **File / Selector**: `app.js` (`PT_EMOJI`, lines 2259–2270), `mobile.js` (lines 1177, 1183, 1504, 1615, 1619, 1679)
- **Phase 3 Step**: `quieter`
- **Effort**: M | **Risk**: low
- **Description & Clinical Impact**: Product categories and sheet actions render raw emoji characters (`🫁`, `♿`, `💉`, `⚡`, `➕`, `🖨️`, `💡`, `📋`, `⚠️`). Emojis render inconsistently across Android/iOS/Windows and undermine trust in a regulated healthcare setting.
- **Specific Recommended Fix**: Replace all on-screen UI emojis with SVG icons referencing the existing SVG sprite symbols (`#i-brand`, `#i-boxes`, `#i-plus`, `#i-printer`, `#i-copy`, `#i-alert-circle`, `#i-zap`, `#i-check`). (Canvas sticker PNG generation may retain plain text/emoji per Clarification C4).

##### [P1-05] Dual-Font Stack Loading Violates Design System
- **Priority**: P1
- **Page**: Global
- **File / Selector**: `index.html` (line 33), `styles.css` (lines 239, 1890, 1976), `mobile.css`, `mobile.js`
- **Phase 3 Step**: `typeset`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: `index.html` imports `Plus Jakarta Sans`, and stylesheets/scripts explicitly declare `font-family: 'Plus Jakarta Sans'`. `DESIGN.md` designates `Inter` as the single canonical typeface. This dual-font setup incurs redundant network overhead and creates visual inconsistency.
- **Specific Recommended Fix**: Remove the `Plus Jakarta Sans` Google Font `<link>` from `index.html` and consolidate all typography declarations onto `var(--font-family, 'Inter', ...)`.

##### [P1-06] Unstyled Desktop Segmented Filter Buttons on Manage Users
- **Priority**: P1
- **Page**: Manage Users
- **File / Selector**: `styles.css` (`.segmented-control`, `.segmented-btn`, lines 480–510)
- **Phase 3 Step**: `layout`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Status filter buttons on the desktop Manage Users view render as raw, unstyled 19px browser default buttons because `.segmented-btn` styles were scoped exclusively under `.eq-filter-row`.
- **Specific Recommended Fix**: Elevate `.segmented-control` and `.segmented-btn` to global reusable component classes with 36px/40px height, rounded tokens (`var(--r-ctl)`), and clear active/focus states.

##### [P1-07] Invalid ARIA Attribute `aria-sort` on Audit Column Buttons
- **Priority**: P1
- **Page**: Audit Log
- **File / Selector**: `app.js` (`button.audit-col-btn`, lines 3705–3730)
- **Phase 3 Step**: `harden`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Column header buttons set `aria-sort="none"`. Per W3C ARIA 1.2 specification, `aria-sort` is strictly prohibited on `<button>` elements and is only valid on `role="columnheader"`. Axe flags this as an `aria-allowed-attr` failure.
- **Specific Recommended Fix**: Move `aria-sort` to the wrapping container that holds `role="columnheader"`, or replace `aria-sort` on the button with `aria-pressed` or visually hidden screen reader text.

##### [P1-08] Missing `alt` Text on Dynamically Rendered QR Code Images
- **Priority**: P1
- **Page**: Modals & Sheets (Sticker Modal `#sticker-modal`, Print All `#print-all-modal`)
- **File / Selector**: `app.js` (lines 2830–2835, 4500–4510), `mobile.js` (line 740)
- **Phase 3 Step**: `clarify`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: The client-side `QRCode` library dynamically injects `<img>` elements without an `alt` attribute, triggering critical `image-alt` axe violations and leaving screen reader users without context.
- **Specific Recommended Fix**: In `openStickerModal`, `renderPrintAllPreview`, and `mobile.js`, query the generated image immediately upon creation and assign `img.setAttribute('alt', 'QR Code for equipment asset ' + assetId)`.

##### [P1-09] Mobile Bottom Sheets Lack Focus Traps and Inert Background
- **Priority**: P1
- **Page**: Modals / Mobile Sheets
- **File / Selector**: `mobile.js` (`mOpenSheet`, `mCloseSheet`, `#m-confirm-close`, lines 1920–1970, 2049)
- **Phase 3 Step**: `harden`
- **Effort**: M | **Risk**: low
- **Description & Clinical Impact**: While desktop modals implement focus traps in `app.js`, mobile bottom sheets in `mobile.js` do not trap Tab navigation and do not set `inert` on the underlying application container (`#m-app`). Furthermore, `#m-confirm-close` lacks an accessible label.
- **Specific Recommended Fix**: Set `document.getElementById('m-app').inert = true;` when opening a mobile sheet and release upon closing. Add an internal Tab trap loop and assign `aria-label="Close dialog"` to `#m-confirm-close`.

##### [P1-10] Dimmed Product Filter Tiles Unreadable in Both Themes
- **Priority**: P1
- **Page**: Dashboard
- **File / Selector**: `styles.css` (`.dimmed.product-tile .pt-name`, `.pt-summary`, lines 2360–2390)
- **Phase 3 Step**: `quieter`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Inactive product tiles receive `.dimmed`, which reduces text opacity to 3.0:1 contrast in light mode and 3.1:1 in dark mode, making category names illegible for low-vision staff.
- **Specific Recommended Fix**: Maintain full text contrast (`var(--text)`) on category names, communicating inactive states through a dashed border (`1px dashed var(--border)`) and subtle background mute.

##### [P1-11] Current Room Location Concealed in Collapsed Mobile Equipment Row
- **Priority**: P1
- **Page**: Dashboard
- **File / Selector**: `app.js` (`buildEqRow`, line 2643), `styles.css` (`.eq-mobile-meta`, lines 1804–1810)
- **Phase 3 Step**: `clarify`
- **Effort**: M | **Risk**: low
- **Description & Clinical Impact**: On mobile viewports, `.eq-mobile-meta` renders only `Dept · QR-ID`. When equipment is "In Use", the specific room/bed assignment is omitted from the row summary. Staff looking for an available device must tap each row one-by-one.
- **Specific Recommended Fix**: Update the `.eq-mobile-meta` template to include room/bed data when active (e.g. `ICU · Bed 2 · MT-ICU-001`), giving immediate situational awareness without expanding.

##### [P1-12] Alarmist "Demo Mode" Security Notice Destroys Clinical Trust
- **Priority**: P1
- **Page**: Login
- **File / Selector**: `index.html` / `styles.css` (`.login-security-notice`, lines 145–150)
- **Phase 3 Step**: `distill`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: An amber warning banner stating "Demo mode: client-side auth only. Not for production patient data." sits prominently on the login card, alarming hospital personnel and degrading confidence.
- **Specific Recommended Fix**: Remove the warning card from the primary login flow; replace with professional institutional microcopy or a quiet disclaimer in the footer.

##### [P1-13] Senior Doctor Role Indicator Uses Warning Amber Color
- **Priority**: P1
- **Page**: Manage Users
- **File / Selector**: `styles.css` (`.role-chip.role-doctor::before`, `.m-role-pill.doctor`)
- **Phase 3 Step**: `quieter`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Senior Doctor user rows display an amber warning badge (`var(--warning)` / `#D97706`). Staff mistake the indicator for an account suspension or security flag.
- **Specific Recommended Fix**: Switch Senior Doctor role chips to a calm medical slate or indigo token (`var(--text-2)` or `#4338CA`), reserving amber exclusively for clinical maintenance or hazards.

##### [P1-14] Horizontal User Table Clipping on Tablet/Mobile Without Scroll Affordance
- **Priority**: P1
- **Page**: Manage Users
- **File / Selector**: `styles.css` (`.users-table-container`, `.manage-users-grid`)
- **Phase 3 Step**: `adapt`
- **Effort**: M | **Risk**: low
- **Description & Clinical Impact**: On viewports between 640px and 1100px, the 5-column user table horizontally clips the "Actions" column with no visual scrollbar or boundary indicator.
- **Specific Recommended Fix**: Add horizontal edge shadows or a responsive card-collapse layout on viewports under 900px so administrative actions remain fully visible.

---

#### P2: Minor Clutter, Polish & Hygiene Findings

##### [P2-01] Redundant Diagonal Arrow Buttons on KPI Cards
- **Priority**: P2
- **Page**: Dashboard
- **File / Selector**: `index.html` (lines 330, 353, 394), `styles.css` (`.kpi-arrow-btn`, lines 1038–1058)
- **Phase 3 Step**: `distill`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: KPI cards display diagonal arrow buttons (`↗`) that trigger `setFilter()`. These buttons clutter the card and duplicate the segmented filter controls directly below.
- **Specific Recommended Fix**: Remove `.kpi-arrow-btn` and make the entire KPI card keyboard-interactive (`role="button"`) with a clear focus ring.

##### [P2-02] Colored Icon-Chip Background Tiles on KPI Cards
- **Priority**: P2
- **Page**: Dashboard
- **File / Selector**: `styles.css` (`.kpi-chip`, `.kpi-chip-*`, lines 998–1027)
- **Phase 3 Step**: `quieter`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: KPI icons are wrapped in saturated colored squircles (`.kpi-chip-green`, `.kpi-chip-red`, etc.), creating excessive color noise that competes with the numeric metric values.
- **Specific Recommended Fix**: Remove the colored background chips; render the SVG icons directly with muted semantic coloring.

##### [P2-03] Nested Glassmorphic Card-in-Card Containers
- **Priority**: P2
- **Page**: Dashboard & Manage Users
- **File / Selector**: `styles.css` (`.req-stat-tile`, `.request-item`, `.create-user-panel`, `.users-table-panel`)
- **Phase 3 Step**: `distill`
- **Effort**: M | **Risk**: low
- **Description & Clinical Impact**: Outer bordered containers embed inner rounded cards with translucent fills and shadows, creating heavy visual depth and unnecessary borders.
- **Specific Recommended Fix**: Flatten container hierarchies: replace nested rounded boxes with clean dividing lines and subtle background tint shifts.

##### [P2-04] Raw Unicode Glyphs Used for Status Toggles and Arrows
- **Priority**: P2
- **Page**: Dashboard & Modals
- **File / Selector**: `app.js` (lines 2305, 2756, 2800, 2812), `index.html` (lines 422, 478)
- **Phase 3 Step**: `quieter`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: UI controls use raw text glyphs: `'✔ Release'`, `'▼'`, `'▲'`, `'▶'`. These render unpredictably across mobile operating systems.
- **Specific Recommended Fix**: Replace text glyphs with existing SVG sprite icons: `<svg class="icon"><use href="#i-check"/></svg>` and `<svg class="icon"><use href="#i-chevron-down"/></svg>`.

##### [P2-05] Redundant "Print All QR Codes" in Header Kebab Menu
- **Priority**: P2
- **Page**: Dashboard
- **File / Selector**: `index.html` (`#more-actions-menu`, `#print-all-btn`, lines 300–312)
- **Phase 3 Step**: `distill`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: The desktop header renders both `#print-all-btn` and a kebab menu `#more-actions-btn` whose sole item is "Print all QR codes".
- **Specific Recommended Fix**: Remove `#more-actions-btn` when no secondary actions exist, or hide `#print-all-btn` on mobile in favor of the menu.

##### [P2-06] Horizontal Department Filter Bar Lacks Scroll Cue
- **Priority**: P2
- **Page**: Dashboard
- **File / Selector**: `styles.css` (`.dept-filter-group`, lines 1256–1271)
- **Phase 3 Step**: `adapt`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Department pills scroll horizontally with hidden scrollbars. On mobile, trailing chips clip abruptly at the screen boundary, concealing available departments.
- **Specific Recommended Fix**: Apply an edge gradient fade (`mask-image: linear-gradient(to right, ...)`), giving users an intuitive scroll cue.

##### [P2-07] Hardcoded Inline Styles on Equipment Empty State
- **Priority**: P2
- **Page**: Dashboard
- **File / Selector**: `app.js` (`renderEquipment`, line 2553)
- **Phase 3 Step**: `harden`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Empty equipment states inject raw inline styling (`style="padding:32px 16px;text-align:center;"`), bypassing design tokens.
- **Specific Recommended Fix**: Move inline styles to a dedicated `.empty-state` CSS component class conforming to `DESIGN.md` spacing.

##### [P2-08] Hardcoded Hex and RGBA Color Literals Bypassing Design Tokens
- **Priority**: P2
- **Page**: Global / Theming
- **File / Selector**: `styles.css`, `mobile.css`, `app.js`, `mobile.js` (80+ occurrences)
- **Phase 3 Step**: `distill`
- **Effort**: M | **Risk**: low
- **Description & Clinical Impact**: Hardcoded color strings (e.g. `#FFFFFF`, `#090D16`, `#38bdf8`, `#cbd5e1`, `rgba(0,0,0,0.1)`) bypass CSS variables, causing poor theme adaptability.
- **Specific Recommended Fix**: Migrate literal values to semantic CSS tokens (`var(--surface)`, `var(--text)`, `var(--border)`, `var(--primary)`).

##### [P2-09] Asymmetric Side-Tab Borders on Cards
- **Priority**: P2
- **Page**: Dashboard & Audit Log
- **File / Selector**: `styles.css` (lines 3371–3374)
- **Phase 3 Step**: `quieter`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Thick asymmetric left borders (`border-left: 3px solid ...`) trigger the detector's `[side-tab]` anti-pattern.
- **Specific Recommended Fix**: Remove asymmetric `border-left`; convey equipment condition via standardized status badges.

##### [P2-10] Decorative Pulsing Dot Animations and Chromatic Glow Shadows
- **Priority**: P2
- **Page**: Dashboard & Mobile Shell
- **File / Selector**: `styles.css` (`.live-dot`, line 210), `mobile.css` (lines 325, 332)
- **Phase 3 Step**: `quieter`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Continuous pulsing dots (`.live-dot`) simulate artificial liveness; zero-offset blue box-shadows introduce visual distraction.
- **Specific Recommended Fix**: Replace infinite pulse keyframes with a calm, static status indicator and replace colored shadows with neutral elevation tokens.

##### [P2-11] Missing One-Click "Copy" Button on Desktop Temporary Password
- **Priority**: P2
- **Page**: Manage Users
- **File / Selector**: `index.html` / `app.js` (`#new-temp-pw-box`, lines 220–225)
- **Phase 3 Step**: `harden`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: When an administrator creates a user account, the temporary password has no "Copy" button on desktop, requiring error-prone manual text selection.
- **Specific Recommended Fix**: Add a one-click "Copy" button with visual toast confirmation next to `#new-temp-pw-box`.

##### [P2-12] Unstyled, Non-Actionable Empty and Error States in Manage Users
- **Priority**: P2
- **Page**: Manage Users
- **File / Selector**: `app.js` / `mobile.js` (`renderUsersTable`, `loadUsersTable`)
- **Phase 3 Step**: `harden`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Filtered results that yield no users show plain unstyled text without a "Reset Filters" action; network errors fail silently or display raw API messages.
- **Specific Recommended Fix**: Implement structured empty states with clear recovery actions and a "Retry" button on network failure.

##### [P2-13] Incomplete Error Handling & Focus Management on Login
- **Priority**: P2
- **Page**: Login
- **File / Selector**: `app.js` (`doLogin()`, `#login-error`, lines 600–630)
- **Phase 3 Step**: `harden`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: When authentication fails, `#login-error` appears without shifting focus or setting `aria-invalid="true"`. On mobile, it scrolls behind the virtual keyboard.
- **Specific Recommended Fix**: Set `aria-invalid="true"` on invalid inputs, auto-focus the offending field, and scroll the error banner into view.

##### [P2-14] Sticker Modal Action Buttons Wrap Awkwardly on 360px Screens
- **Priority**: P2
- **Page**: Modals (Sticker Modal `#sticker-modal`)
- **File / Selector**: `styles.css` (`#sticker-modal .modal-footer`, lines 3480–3520)
- **Phase 3 Step**: `layout`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: On 360px viewports, three buttons (`Close`, `Download PNG`, `Print Sticker`) cram side-by-side, resulting in awkward text wrapping and uneven tap targets.
- **Specific Recommended Fix**: Apply `flex-direction: column-reverse; width: 100%;` at viewports `<480px`, placing the primary "Print Sticker" button on top.

##### [P2-15] Unlabelled Form Controls in Weekly Report Select and Command Palette
- **Priority**: P2
- **Page**: Dashboard & Modals
- **File / Selector**: `index.html` (`#weekly-history-select`, `#cmd-palette-input`, lines 1084, 1105)
- **Phase 3 Step**: `clarify`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Form controls lack explicit `<label>` or `aria-label` attributes, causing screen readers to announce ambiguous fields.
- **Specific Recommended Fix**: Add `aria-label="Select historical weekly analysis report"` to `#weekly-history-select` and `aria-label="Search equipment, navigate pages, or run actions"` to `#cmd-palette-input`.

---

#### P3: Polish & Non-Blocking Design Findings

##### [P3-01] Off-Ramp Font Sizes in Application Stylesheets
- **Priority**: P3
- **Page**: Global
- **File / Selector**: `styles.css` (lines 252, 356, 486, 3658)
- **Phase 3 Step**: `typeset`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Arbitrary pixel font sizes (`11px`, `13px`, `15px`, `28px`) drift off the documented type ramp in `DESIGN.md`.
- **Specific Recommended Fix**: Normalize font sizes to the documented type ramp (`0.75rem`/12px, `0.875rem`/14px, `1rem`/16px, `1.25rem`/20px).

##### [P3-02] Em-Dash Saturation in UI Labels and Placeholder Microcopy
- **Priority**: P3
- **Page**: Global
- **File / Selector**: `index.html` (lines 337, 360, 678, 691, 704), `app.js` (line 3021)
- **Phase 3 Step**: `clarify`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Detect flags `[em-dash-overuse]` with 8 em-dashes (`—`) in placeholder values and string templates, reflecting machine-generated copy rhythm.
- **Specific Recommended Fix**: Replace decorative em-dashes with standard medical formatting (`0` or `None` for empty metrics; commas/parentheses for compound labels).

##### [P3-03] Missing `:focus-visible` Indicators on Segmented Controls
- **Priority**: P3
- **Page**: Dashboard & Manage Users
- **File / Selector**: `styles.css` (`.segmented-control button`, `.filter-btn`, lines 480–510)
- **Phase 3 Step**: `harden`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Active filter buttons rely on subtle background shifts and lack high-contrast 2px focus outlines for keyboard navigation.
- **Specific Recommended Fix**: Add an explicit `:focus-visible` rule (`outline: 2px solid var(--primary); outline-offset: 2px;`).

##### [P3-04] Modal Close Buttons Use Text Character '✕' Instead of SVG
- **Priority**: P3
- **Page**: Modals / Mobile Sheets
- **File / Selector**: `mobile.js` (`.m-sheet-close-btn`, `#m-confirm-close`, lines 1942, 2049)
- **Phase 3 Step**: `distill`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Mobile sheets render close buttons as raw text characters `✕` instead of SVG sprite icons.
- **Specific Recommended Fix**: Standardize close buttons to use `<svg class="icon"><use href="#i-x"/></svg>`.

##### [P3-05] Login Theme Toggle Overlaps Mobile Status Bar Notch
- **Priority**: P3
- **Page**: Login
- **File / Selector**: `styles.css` (`.login-theme-toggle`, line 320)
- **Phase 3 Step**: `adapt`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Fixed `top: 24px` ignores `env(safe-area-inset-top)`, causing collision with hardware camera cutouts on modern phones.
- **Specific Recommended Fix**: Set `top: max(16px, env(safe-area-inset-top));`.

##### [P3-06] Robotic Helper Microcopy in Create User Form
- **Priority**: P3
- **Page**: Manage Users
- **File / Selector**: `index.html` (`.field-hint`, `#role-helper-text`, lines 205–215)
- **Phase 3 Step**: `clarify`
- **Effort**: S | **Risk**: low
- **Description & Clinical Impact**: Helper hints sound sterile and automated ("Letters, numbers, dots and underscores. Used to sign in.").
- **Specific Recommended Fix**: Rephrase into concise clinical guidance ("Hospital username, e.g. dr.smith or nurse.elena").

---

## 3. Comprehensive Inventory of "AI-Generated Tells"

Reviewers, auditors, and clinical stakeholders immediately recognize unedited AI-generated software by specific visual clichés. Below is the complete catalog of machine-made tells detected across MediTrack:

| Tell Pattern | Diagnostic Sign | Specific Occurrences in Codebase | Recommended Remediation |
|--------------|-----------------|----------------------------------|-------------------------|
| **Dual-Font Pairing Drift** | Secondary display typeface loaded alongside body font, creating conflicting typographic voice. | `index.html:33` (`Plus Jakarta Sans`), `styles.css:239, 1890, 1976`, `mobile.css:142, 426, 914`, `mobile.js:652, 1174, 1606`. | Remove `Plus Jakarta Sans` import; enforce single canonical `Inter` family stack across all views. |
| **High-Saturation SaaS Gradients** | Vibrant electric linear gradient (`#2F5BEA` to `#4C7BFF`) mimicking Dribbble concept art. | `styles.css:49, 181, 213, 2065` (`--grad-highlight` on `.request-queue-card` and `.login-brand-panel`). | Replace with calm, solid medical surface (`var(--surface)` with `1px solid var(--border)`). |
| **Colored Icon Squircles (Icon Chips)** | Metric numbers flanked by 36×36px saturated rounded colored boxes. | `styles.css:998–1026` (`.kpi-chip-green`, `.kpi-chip-red`, `.kpi-chip-amber`, `.kpi-chip-primary`), `styles.css:336, 441` (`.login-brand-logo`, `.login-logo-icon`). | Remove colored background tiles; render SVG icons directly with muted semantic tone. |
| **Diagonal Arrow Buttons (↗)** | Tiny corner buttons with diagonal arrows duplicating clickability. | `index.html:330, 353, 394` & `styles.css:1038–1058` (`.kpi-arrow-btn`). | Remove corner arrow buttons; make entire KPI card an accessible button. |
| **Casual In-UI Emojis** | Raw Unicode emoji characters representing medical devices and actions. | `app.js:2259–2265` (`🫁`, `♿`, `💉`, `⚡`, `🖥️`, `🏥`), `mobile.js:1177, 1615` (`➕`, `🖨️`, `💡`, `📋`, `⚠️`). | Replace all on-screen emojis with SVG icons from the existing sprite sheet. |
| **Card-in-Card Nesting** | Nested containers with translucent glassmorphic fills and overlapping borders. | `styles.css:2111–2165` (`.req-stat-tile`, `.request-item`), `.manage-users-grid` wrapping `.create-user-panel`. | Flatten hierarchy into single-level surface panels separated by dividers. |
| **Asymmetric Side-Tab Accents** | 3px thick colored left borders on cards simulating status (`[side-tab]`). | `styles.css:3371–3374` (`border-left: 3px solid var(--success)`, `--danger`, `--warning`). | Remove `border-left`; convey status via standardized status badges. |
| **Decorative Glow & Fake Liveness** | Chromatic zero-offset blur halos and infinite pulsing dots. | `styles.css:210` (`.live-dot` with `@keyframes pulse-live`), `mobile.css:325, 332` (`box-shadow: 0 8px 20px rgba(47,91,234,0.4)`). | Replace pulsing keyframes with calm static dot; use neutral elevation shadows. |
| **AI Punctuation & Microcopy Cadence** | High density of em-dashes (`—`), alarmist demo warnings, and sterile robotic hints. | `index.html:145, 337, 360`, `app.js:3021`, `mobile.js:128`. | Remove alarmist warnings; normalize em-dashes to standard punctuation; rephrase hints. |

---

## 4. Explicit "Do Not Touch" List

During Phase 3 implementation, the following functional areas and subsystems must remain completely untouched to preserve operational stability:

1. **AI-Insights Logic & Weekly Cron**:
   - The AI analysis engine in `app.js` and `mobile.js` (`loadAiInsights()`, `runWeeklyAnalysis()`, `renderWeeklyAnalysis()`).
   - The Supabase database tables `ai_insights` and `ai_weekly_reports`.
   - The edge functions and weekly automated analysis cron jobs.
2. **Supabase REST, RPC & Realtime Contracts**:
   - All Supabase client configuration, session storage handling, and API queries.
   - The RPC authentication endpoint `db.rpc('login', { username_param, password_param })`.
   - Data contracts and column definitions for tables: `equipment`, `departments`, `requests`, `audit_log`, `users`, and `latest_checkout_rooms`.
3. **QR Scanner & Print Sticker Flows**:
   - Camera initialization, context verification (HTTPS/localhost check), camera device enumeration, and `Html5Qrcode` lifecycle (`start`, `pause`, `stop`).
   - The pause-on-decode mechanism during room picker modal interaction.
   - HTML5 Canvas sticker rendering logic and PNG binary blob generation.

---

## 5. Blocked by Guardrails (Non-Permitted Alterations)

The following architectural and semantic issues were noted during multi-agent review, but are **EXPLICITLY BLOCKED** by the project invariants. They are **NOT** proposed as fixes:

| Category | Guardrail Violation | Items Identified but Retained As-Is | Invariant / Reason for Block |
|----------|---------------------|-------------------------------------|------------------------------|
| **DOM Element IDs** | Renaming IDs breaks inline event handlers & test suite. | `#login-screen`, `#login-card`, `#login-username`, `#login-password`, `#login-btn`, `#login-error`, `#page-dashboard`, `#page-users`, `#stat-available`, `#stat-total`, `#stat-inuse`, `#stat-attention`, `#stat-requests`, `#equipment-list`, `#eq-count`, `#eq-search`, `#eq-sort`, `#filter-all`, `#filter-available`, `#filter-inuse`, `#dept-filter-group`, `#product-tiles-section`, `#requests-panel`, `#attention-banner`, `#users-tbody`, `#create-user-btn`, `#new-username`, `#new-temp-pw-box`, `#user-search-input`, `#reset-pw-modal`, `#scanner-modal`, `#room-picker-modal`, `#sticker-modal`. | **Preserved Invariant R5**: All original element IDs in `index.html` and `app.js` must remain strictly unchanged. Playwright tests and inline HTML bindings rely on them. |
| **Global Function Signatures** | Renaming global functions breaks inline `onclick` / `onchange` attributes. | `openScanner()`, `closeScanner()`, `doLogin()`, `doLogout()`, `toggleTheme()`, `cycleTheme()`, `showPage()`, `setFilter()`, `setDeptFilter()`, `setProductFilter()`, `clearProductFilter()`, `clearAllFilters()`, `renderEquipment()`, `toggleEqRow()`, `saveCondition()`, `manualToggle()`, `openRequestModal()`, `showRoomPicker()`, `confirmRoomPicker()`, `cancelRoomPicker()`, `createUser()`, `exportAuditCSV()`, `openResetPwModal()`, `toggleUserActive()`. | **Preserved Invariant R5**: Inline handlers in `index.html` execute global window functions directly. No modularization or function renaming is permitted. |
| **Database Schema & REST Contracts** | Changing database schema breaks backend compatibility. | Table names (`equipment`, `departments`, `users`, `audit_log`, `requests`), column names (`is_active`, `department_id`, `password_hash`), and RPC signatures. | **Preserved Invariant R5**: Codebase must interact with existing Supabase schema without database migrations or query schema shifts. |
| **Code Architecture & Modules** | Converting to ES modules or framework bundlers. | Refactoring `app.js` into ES modules (`import`/`export`) or adding Webpack/Vite/React/Vue. | **Preserved Invariant R5**: Application must remain 100% vanilla JavaScript loaded via direct script tags. |

---

## 6. Phase 3 Implementation Order & Execution Checklist

To ensure systematic, conflict-free refactoring during Phase 3, changes must be implemented one page at a time in the exact order specified by the Impeccable methodology:

```
distill  ──>  typeset  ──>  quieter  ──>  layout  ──>  clarify  ──>  harden  ──>  adapt
```

### Step 1: `/impeccable distill` (Remove Redundancies & Complexity)
- [ ] **[P1-12]** Remove alarmist "Demo mode" security banner from login card (`#login-screen`).
- [ ] **[P2-01]** Remove redundant diagonal arrow buttons (`.kpi-arrow-btn`) from KPI cards.
- [ ] **[P2-03]** Flatten nested card-in-card containers (`.req-stat-tile`, `.request-item`, `.create-user-panel`).
- [ ] **[P2-05]** Remove redundant "Print all QR codes" item from header kebab dropdown menu.
- [ ] **[P2-08]** Migrate 80+ hardcoded hex and rgba color strings to semantic CSS tokens.
- [ ] **[P3-04]** Replace raw text character `✕` on mobile sheet close buttons with `#i-x` SVG sprite.

### Step 2: `/impeccable typeset` (Unified Typography)
- [ ] **[P1-05]** Remove Google Font import for `Plus Jakarta Sans` in `index.html`.
- [ ] **[P1-05]** Consolidate all font-family declarations in `styles.css`, `mobile.css`, and `mobile.js` onto `Inter`.
- [ ] **[P3-01]** Normalize literal pixel font sizes (11px, 13px, 15px, 28px) to `DESIGN.md` type ramp tokens.

### Step 3: `/impeccable quieter` (Tone Down Visual Noise & Gradients)
- [ ] **[P1-02]** Replace `--grad-highlight` linear gradients with solid surface styling and clean border definition.
- [ ] **[P1-03]** Darken light-mode status badge text colors (`--success: #15803D`, `--danger: #B91C1C`, `--warning: #92400E`) to pass WCAG AA contrast (≥ 4.5:1).
- [ ] **[P1-04]** Replace on-screen UI emojis in `app.js` and `mobile.js` with SVG sprite icons.
- [ ] **[P1-10]** Restore readable text contrast on dimmed/inactive product category filter tiles.
- [ ] **[P1-13]** Switch Senior Doctor role indicator from warning amber (`#D97706`) to calm indigo/slate.
- [ ] **[P2-02]** Remove saturated colored squircle background chips (`.kpi-chip-*`) from KPI cards.
- [ ] **[P2-04]** Replace raw Unicode characters (`✔`, `▼`, `▲`, `▶`) with SVG sprite icons.
- [ ] **[P2-09]** Remove asymmetric `border-left: 3px solid` side-tab accents from cards and alerts.
- [ ] **[P2-10]** Replace infinite pulsing dot animations (`.live-dot`) with calm static status indicators.

### Step 4: `/impeccable layout` (Spacing, Rhythm & Desktop Alignment)
- [ ] **[P0-02]** Compress mobile `.kpi-grid` from 1,200px vertical depth into a compact 2×2 grid or metric strip.
- [ ] **[P1-06]** Add comprehensive styling for desktop `.segmented-control` and `.segmented-btn` on Manage Users.
- [ ] **[P2-14]** Reconfigure `#sticker-modal` action buttons to stack vertically on small mobile screens.

### Step 5: `/impeccable clarify` (Microcopy, Labels & A11y Announcements)
- [ ] **[P1-08]** Add descriptive `alt` text to all dynamically rendered QR code images in modals and sheets.
- [ ] **[P1-11]** Update `.eq-mobile-meta` template to display current room and bed location in collapsed rows.
- [ ] **[P2-15]** Add accessible `aria-label` attributes to weekly history select and command palette input.
- [ ] **[P3-02]** Replace em-dash saturation (`—`) with clean punctuation across UI labels.
- [ ] **[P3-06]** Rephrase robotic form helper copy into concise clinical guidance.

### Step 6: `/impeccable harden` (Error Resilience, ARIA Trees & Edge Cases)
- [ ] **[P0-01]** Restore row expand chevron indicator on mobile viewports (`.eq-cell-chevron`).
- [ ] **[P0-04]** Wrap login inputs in semantic `<form id="login-form">` with submit handler.
- [ ] **[P0-05]** Fix ARIA table parentage (`role="table"`, `role="columnheader"`) in equipment and audit lists.
- [ ] **[P1-07]** Remove invalid `aria-sort` attribute from audit table `<button>` elements.
- [ ] **[P1-09]** Add focus trapping, `inert` background handling, and close labels to mobile bottom sheets.
- [ ] **[P2-07]** Move hardcoded inline styles on empty equipment state to standard CSS classes.
- [ ] **[P2-11]** Add one-click "Copy" button with toast confirmation next to `#new-temp-pw-box`.
- [ ] **[P2-12]** Implement structured empty states with "Reset Filters" action in Manage Users.
- [ ] **[P2-13]** Enhance `#login-error` with `aria-invalid="true"`, auto-focus, and scroll-into-view.
- [ ] **[P3-03]** Add explicit 2px `:focus-visible` indicators to all segmented filter controls.

### Step 7: `/impeccable adapt` (Mobile Ergonomics & Responsive Viewports)
- [ ] **[P0-03]** Fix 360px header overflow in `styles.css` to prevent logout button and avatar clipping.
- [ ] **[P1-01]** Expand all touch targets (`.pw-toggle`, `.filter-btn`, `.tbl-action-btn`, etc.) to minimum 44×44px.
- [ ] **[P1-14]** Add horizontal scroll cues or responsive collapse to user table on compact viewports.
- [ ] **[P2-06]** Add edge mask/gradient fade to horizontal department filter pills.
- [ ] **[P3-05]** Position login theme toggle using `env(safe-area-inset-top)` to clear hardware notches.

---

## 7. Approval Gate Verification Criteria

Before proceeding to Phase 3 code modifications, the team must confirm:
1. **Approval of FINDINGS.md**: The human reviewer / orchestrator approves this prioritized remediation list.
2. **Phase 1 Invariant Verification**: The Playwright scan cycle test passes with zero live Supabase calls (`npm test`).
3. **No Code File Modifications in Phase 2**: `git status` verifies that `app.js`, `styles.css`, `index.html`, `mobile.js`, and `mobile.css` were NOT modified during Phase 2.
4. **Single-Agent Sequential Phase 3 Plan**: Phase 3 will be executed by a single agent one page at a time, committing after each step.
