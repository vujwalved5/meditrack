# MediTrack Mobile UI — QA Report

## 1. Summary
- **Stack found / approach used**: Vanilla HTML5, CSS3, ES6+ JavaScript. Realtime Supabase PostgreSQL backend (`@supabase/supabase-js`), `html5-qrcode` scanner, `qrcode.min.js`, `bcrypt.js`. Additive architecture (`mobile.css`, `mobile.js`) activated at `max-width: 767px` via `window.matchMedia`.
- **Desktop regression**: PASS — 0 px diff across all 50 screenshots (widths 768, 1024, 1280, 1440, 1920 in light & dark for login, dashboard, dashboard-insights-open, audit, users).
- **Commands**:
  - `npm run lint`: ✅ (0 errors)
  - `npm run build`: ✅ (index.html valid)
  - `npm test` (vitest): 36 passed, 4 failed (pre-existing in `tests/dom_integration.test.js`)
  - Playwright desktop regression: ✅ (50/50 exact match)
- **IDs**: M-01…M-20 and PL-01…PL-28 → In progress (Phase 0 completed, Phase 1 beginning).

---

## 2. Discovery Answers (Section 3.1)

### 1. Stack and Existing Design Tokens
- **Architecture**: Vanilla HTML5, CSS custom properties, vanilla JavaScript. Single-page application structure with login and main dashboard view toggled via CSS display.
- **Design Tokens**:
  - Background & Surface: `--bg` (`#F3F4F6` light / `#0F1012` dark), `--surface` (`#FFFFFF` / `#1B1C1F`), `--surface-2` (`#F7F8FA` / `#232428`), `--border` (`#E8EAEE` / `#2C2D32`)
  - Typography Colors: `--text` (`#14161A` / `#F2F3F5`), `--text-2` (`#5B616B` / `#B0B4BC`), `--text-3` (`#8B919B` / `#7E838D`)
  - Brand & Status: `--primary` (`#2F5BEA` / `#4F7BFF`), `--primary-strong` (`#2548C4` / `#6D93FF`), `--primary-tint` (`#E9EEFD` / `#1E2A4F`), `--success` (`#16A34A` / `#34D399`), `--danger` (`#DC2626` / `#F87171`), `--warning` (`#D97706` / `#FBBF24`), `--neutral` (`#6B7280` / `#9CA3AF`)
  - Status Classes: `.badge-status-available`, `.badge-status-inuse`, `.badge-status-attention`, `.badge-status-critical`, `.badge-status-neutral`, `.badge-status-active`

### 2. Existing Breakpoints in `styles.css`
- `@media (max-width: 1099px)`: Responsive adjustments for large tablets.
- `@media (max-width: 899px)`: Navigation stacking, mobile drawer toggle.
- `@media (max-width: 759px)`: Legacy table column layout.
- `@media (min-width: 760px)`: Desktop grid/table sizing.
- `@media (max-width: 639px)`: 1-column KPI grid, 2-column product tile grid, stacked panel controls.
- **Coexistence Strategy**: `mobile.css` hides the desktop container when `#m-app` or `html.m-boot` is active at `max-width: 767px`. Desktop breakpoints in `styles.css` remain untouched.

### 3. Feature Inventory Table
| Desktop Feature | Where in Code | Roles Allowed | Mobile Home |
|---|---|---|---|
| KPI cards (Available / In use / Needs attention / Pending requests / Total) | `app.js:2854-2879`, `139-162` | All authenticated roles | KPI strip (M-04) |
| AI Insights (Morning Brief, Forgotten Equipment, Rebalancing) | `app.js:1048, 1400-1950` | All authenticated roles | More tab → AI Insights (M-16) |
| Weekly Deep Analysis (Run / View report) | `app.js:1049, 1950-2050` | Manager only | More tab → Weekly Analysis (M-16) |
| Product-type filter | `app.js:184-203, 1044` | All authenticated roles | Product pills (M-06) |
| Search, sort, status filter, department filter | `app.js:2191-2240, 2909-2930, 252-281` | All authenticated roles | Sticky filter bar (M-07) |
| Equipment row expand (all fields, QR, condition, history, actions) | `app.js:2683-2784, 2786-2832` | All authenticated roles (actions role-gated) | Equipment sheet (M-09) |
| Check out (room picker) | `app.js:2935-3037` (`manualToggle`, `doToggle`) | All roles (condition $\neq$ Out of Order) | Equipment sheet (M-09) + Scanner (M-11) |
| Release equipment | `app.js:2935-3001` | Holder of item OR Manager | Equipment sheet (M-09) + Scanner (M-11) |
| Force release | `app.js:2938-2941` | Manager only | Equipment sheet (M-09) + Scanner (M-11) (with confirm) |
| Request access | `app.js:3181-3240` | Senior Doctor, Staff (Manager forbidden) | Equipment sheet (M-09) + Scanner (M-11) |
| Scan QR | `app.js:3077-3176` (`Html5Qrcode`) | All authenticated roles | Center FAB (M-03 / M-11) |
| Add Product | `app.js:4120-4270` | Manager only | More tab → Manager tools (M-16) |
| Print all QR | `app.js:4415-4475` | Manager only | More tab → Manager tools (M-16) |
| Print single QR sticker | `app.js:4350-4410` | All authenticated roles | Equipment sheet (M-09) |
| Pending requests: approve / reject | `app.js:3251-3343` | Manager, Senior Doctor (no self-approval) | Requests tab (M-12) |
| Audit log: search, filters, per-item history, Export CSV | `app.js:3348-3880` | Manager, Senior Doctor (Staff denied) | Audit tab (M-13) |
| Manage Users: list, create, role, dept, reset pw, deactivate, reactivate | `app.js:3886-4118` | Manager only | More tab → Manage users (M-17) |
| Theme toggle, logout, Live indicator | `app.js:798-860, 2114-2121` | All authenticated roles | Header + More tab |

### 4. Role/Permission Matrix
| Action | Exact Desktop Condition | Roles Allowed |
|---|---|---|
| View Equipment | Any authenticated user | Manager, Senior Doctor, Staff |
| Check Out (Available) | `eq.status === 'Available' && eq.condition !== 'Out of Order'` | Manager, Senior Doctor, Staff |
| Release (Own) | `eq.status === 'In Use' && eq.held_by === currentUser.username` | Manager, Senior Doctor, Staff |
| Force Release | `eq.status === 'In Use' && currentUser.role === 'Manager'` | Manager only |
| Request Access | `eq.status === 'In Use' && currentUser.role !== 'Manager' && eq.held_by !== currentUser.username` | Senior Doctor, Staff |
| Approve/Reject Request | `(currentUser.role === 'Manager' \|\| currentUser.role === 'Senior Doctor') && req.requested_by !== currentUser.username` | Manager, Senior Doctor |
| View Audit Log | `currentUser.role !== 'Staff'` | Manager, Senior Doctor |
| Export Audit CSV | `currentUser.role !== 'Staff'` | Manager, Senior Doctor |
| Manage Users | `currentUser.role === 'Manager'` | Manager only |
| Add Product | `currentUser.role === 'Manager'` | Manager only |
| Print All QR | `currentUser.role === 'Manager'` | Manager only |
| Run Weekly AI Analysis | `currentUser.role === 'Manager'` | Manager only |
| Edit Condition | `currentUser.role === 'Manager'` | Manager only |

### 5. Function Access & Hooks Needed
- Directly callable: `db`, `Html5Qrcode`, `QRCode`, `dcodeIO.bcrypt`, `formatEnum`, `renderStatusBadge`, `computeEquipmentCounts`, `groupEquipmentByProductType`, `DEPT_ROOMS`.
- Minimal hooks (Section 2.5):
  - In `index.html`: `<link rel="stylesheet" href="mobile.css">`, `<script src="mobile.js"></script>`, early `m-boot` head script, `viewport-fit=cover`.
  - In `app.js`: read-only state/actions export `window.MediTrack = { getState, actions }` + event dispatch `document.dispatchEvent(new CustomEvent('meditrack:render'))`.

### 6. Realtime Mechanism
- Desktop subscribes to `equipment-rt`, `requests-rt`, `auditlog-rt`, `ai-insights-rt`, and `ai-weekly-rt`.
- Mobile subscribes to the same local state updates via `meditrack:render` custom event. No duplicate channels created.

### 7. QR Scanner Architecture
- Uses `Html5Qrcode` library loaded via CDN.
- Camera constraints: `{ facingMode: 'environment' }`.
- Torch supported if `track.getCapabilities().torch` is true.
- On close, tracks are terminated cleanly with `.stop().then(() => .clear())`.

### 8. Definition of "Needs Attention / Alerts"
- Sourced from `computeEquipmentCounts()` in `app.js:139-162`:
  `needs_attention = maintenance + out_of_service`, where `condition === 'Needs Maintenance'` or `condition === 'Out of Order'`.

### 9. Equipment Data Fields
- `id`, `qr_code_id`, `name`, `department_id`, `status` ('Available', 'In Use'), `condition` ('Usable', 'Needs Maintenance', 'Out of Order'), `held_by`, `in_use_since`, `product_type_id`, `departments.name`, `product_types.name`. Location room is resolved from `latestCheckoutRoom[eq.id]`.

---

## 3. Item Status (M-xx, PL-xx, T-Mxx)

| ID | Status | Files Changed | Verified By | Notes |
|---|---|---|---|---|
| M-01 | Planned | `mobile.css`, `mobile.js` | T-M01, layout audit | App shell and viewport (100dvh, no horizontal scroll) |
| M-02 | Planned | `mobile.css`, `mobile.js` | T-M01 | Compact sticky header with Live indicator & role pill |
| M-03 | Planned | `mobile.css`, `mobile.js` | T-M01, T-M14 | Bottom navigation (thumb zone, role-gated tabs, keyboard hide) |
| M-04 | Planned | `mobile.css`, `mobile.js` | T-M02, T-M03 | 4-KPI ribbon with real counts & 1-tap filter toggle |
| M-05 | Planned | `mobile.css`, `mobile.js` | T-M02 | Attention banner with real alerts count |
| M-06 | Planned | `mobile.css`, `mobile.js` | T-M03 | Dynamic product-type pills |
| M-07 | Planned | `mobile.css`, `mobile.js` | T-M03, T-M14 | Sticky search & filters (< 96px tall, 16px font) |
| M-08 | Planned | `mobile.css`, `mobile.js` | T-M04, T-M28 | High-density list rows (60px, chunk rendering) |
| M-09 | Planned | `mobile.css`, `mobile.js` | T-M04, T-M16 | Equipment bottom sheet with QR & real actions |
| M-10 | Planned | `mobile.css`, `mobile.js` | T-M05 | 1-tap room chips (no pre-selected room) |
| M-11 | Planned | `mobile.css`, `mobile.js` | T-M08 | Real scanner flow with 6 states & camera cleanup |
| M-12 | Planned | `mobile.css`, `mobile.js` | T-M09 | Requests tab with real approve/reject & badge sync |
| M-13 | Planned | `mobile.css`, `mobile.js` | T-M10 | Audit tab with search, filters, per-item history, CSV export |
| M-14 | Planned | `mobile.css`, `mobile.js` | T-M13 | Shared bottom sheet component (back button, scroll lock, focus trap) |
| M-15 | Planned | `mobile.css`, `mobile.js` | T-M06, T-M12 | Shared confirm sheet for destructive actions |
| M-16 | Planned | `mobile.css`, `mobile.js` | T-M11 | More tab (Account card, theme toggle, AI insights, manager tools) |
| M-17 | Planned | `mobile.css`, `mobile.js` | T-M12 | Manage Users sub-screen with full desktop parity |
| M-18 | Planned | `mobile.css`, `mobile.js` | T-M05, T-M09 | Accessible toast system (no decorative "LIVE" tag) |
| M-19 | Planned | `mobile.css`, `mobile.js` | T-M15 | Loading, empty, error, and offline states |
| M-20 | Planned | `mobile.css` | T-M18 | Comprehensive dark mode verification using design tokens |
| PL-01 | Planned | `mobile.css` | Tap audit | Touch targets $\ge 44\text{px}$ primary, $\ge 32\text{px}$ chips |
| PL-02 | Planned | `mobile.css` | Font audit | Min 11px text, inputs 16px to prevent iOS zoom |
| PL-03 | Planned | `mobile.css`, `mobile.js` | Visual audit | Replace emoji with inline SVGs |
| PL-04 | Planned | `mobile.css` | Visual audit | Same status tokens/classes as desktop (red reserved for danger) |
| PL-05 | Planned | `mobile.js` | T-M05 | No room pre-selected; confirm disabled until chosen |
| PL-06 | Planned | `mobile.js` | T-M06 | Force release role-gated to Manager only, behind confirm |
| PL-07 | Planned | `mobile.js` | T-M04 | Equipment sheet includes QR image, sticker print, all desktop fields |
| PL-08 | Planned | `mobile.js` | T-M11 | Theme toggle & logout in More tab; tab renamed to More |
| PL-09 | Planned | `mobile.js` | T-M12 | Manage users full parity with real counts & actions |
| PL-10 | Planned | `mobile.js` | T-M11 | All desktop insight cards present including Weekly Analysis |
| PL-11 | Planned | `mobile.js` | Visual audit | Department bars width = available / total |
| PL-12 | Planned | `mobile.js` | T-M03 | KPI tiles have active state (`aria-pressed`, primary border) |
| PL-13 | Planned | `mobile.js` | T-M02 | No hard-coded numbers or dates |
| PL-14 | Planned | `mobile.js` | Visual audit | Remove decorative "LIVE" tag from toasts |
| PL-15 | Planned | `mobile.js` | T-M13 | Bottom sheets handle back button, body scroll lock, focus trap |
| PL-16 | Planned | `mobile.css`, `mobile.js` | T-M14 | Bottom nav & FAB hidden when keyboard opens |
| PL-17 | Planned | `mobile.js` | T-M16 | Live conflict handling updates open sheet in place |
| PL-18 | Planned | `mobile.js` | T-M15 | Loading skeletons, error retry, offline banner |
| PL-19 | Planned | `mobile.css` | A11y audit | No `--text-3` on text < 14px |
| PL-20 | Planned | `mobile.js` | T-M08 | Real camera scanner with 6 states and torch capability check |
| PL-21 | Planned | `mobile.js` | T-M10 | Audit tab parity with filters and per-item history sheet |
| PL-22 | Planned | `mobile.js` | T-M04 | No inline check-out buttons on rows; row tap opens sheet |
| PL-23 | Planned | `mobile.js` | T-M02 | Alerts definition matches desktop "Needs attention" |
| PL-24 | Planned | `mobile.js` | T-M01 | Role-based tabs (Audit hidden for Staff) |
| PL-25 | Planned | `mobile.css` | Code review | No Tailwind CDN, no phone frame, no studio chrome |
| PL-26 | Planned | `mobile.css` | Layout audit | Fluid 320–767px layout |
| PL-27 | Planned | `mobile.js` | T-M09 | Reject uses confirm sheet |
| PL-28 | Planned | `mobile.js` | Performance | Chunk rendering (30 items) + ellipsis for long names |

---

## 4. Changes to Existing Files (Section 2.5 Hooks)
*To be populated during Phase 1. 0 removed or changed lines in existing CSS.*

---

## 5. Deviations from the Prototype and Why
1. Prototype uses hard-coded data and mock timeouts; implementation connects to real Supabase database and existing functions.
2. Prototype includes studio chrome, phone frames, and Tailwind classes; implementation uses vanilla CSS scoped to max-width: 767px.
3. Prototype has small tap targets and 10px text; implementation enforces minimum 44px tap targets and 16px form inputs to prevent iOS Safari zoom.
4. Prototype displays Audit Log to all roles; implementation hides Audit tab for Staff to match desktop permissions.
5. Prototype pre-selects the first room in check-out; implementation requires explicit tap on a room chip before the confirm button enables.

---

## 6. Assumptions Made
- Supabase anon key and URL in `app.js` are used for read-only queries and testing against test accounts without mutating production records.
- Inactive demo users in the database (`demo.nurse.icu`, `demo.nurse.gw`, `demo.ravi`, `demo.anita`) are filtered by the "Hide demo" toggle in user management, matching desktop behavior.
