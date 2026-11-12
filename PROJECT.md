# Project: MediTrack Redesign & Production Hardening

## Architecture
- Vanilla JavaScript single-page application (`app.js`, `index.html`, `styles.css`)
- Backend & Auth: Supabase (REST & Auth APIs)
- QR Scanning: `html5-qrcode` & `qrcodejs` (vendored locally in `/vendor`)
- Target: Mobile browser on busy ward phones (responsive, touch-friendly, high contrast, calm, trustworthy, fast)

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Setup & Baseline | Git branch `impeccable-redesign`, doctor, init, document, baseline detect | Phase 1 | R1 |
| 2 | QR Scanning Fixes | Camera context check, auto-focus manual input on non-secure, pause on decode, race condition fix, case/whitespace trim, getCameras fallback | Phase 1 | R2 |
| 3 | Vendor Libraries | Self-host html5-qrcode and qrcodejs in `/vendor`, remove CDN scripts | Phase 1 | R2, C1 |
| 4 | Error Handling & Deduplication | Specific scan errors, deduplicate showToast/doLogout, unify theme key | Phase 1 | R2 |
| 5 | Playwright Verification | Full scan cycle test with Supabase route mocking (zero live calls) | Phase 1 | R2, C2 |
| 6 | Parallel Review | Multi-agent review (Agent A: dashboard, Agent B: a11y/responsive/theming, Agent C: login/users) | Phase 2 | R3 |
| 7 | Findings Compilation | Consolidated, prioritized fix list `FINDINGS.md` presented for approval | Phase 2 | R3 |
| 8 | Phased UI/UX Refactor | Sequential fixes (distill, typeset, quieter, layout, clarify, harden, adapt) | Phase 3 | R4 |
| 9 | SVG Sprite Migration | Replace emojis in on-screen UI with existing SVG sprite icons | Phase 3 | R4 |
| 10 | Final Polish & Comparison | Run /impeccable polish, before/after detect count, manual checklist | Phase 4 | R4, C5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Phase 1: Setup, Baseline & QR/Core Fixes | Branching, baseline detect, QR scanner fixes, vendoring, code cleanup, Playwright mock test | none | DONE |
| 2 | Phase 2: Multi-Agent Design Review | Parallel read-only critique & audit (Agents A, B, C) -> FINDINGS.md | Phase 1 | DONE |
| 3 | Phase 3: Phased UI/UX Fixes | Sequential design refactoring based on approved FINDINGS.md | Phase 2 | IN_PROGRESS |
| 4 | Phase 4: Final Polish & Verification | Polish, before/after metrics, end-to-end verification, phone checklist | Phase 3 | PLANNED |

## Code Layout
- `index.html`: Main SPA markup, modals, SVG sprite symbols
- `app.js`: Core client application logic, QR handling, Supabase interaction, UI state
- `styles.css`: Application styling, CSS variables, dark mode
- `vendor/`: Local self-hosted copies of `html5-qrcode.min.js` and `qrcode.min.js`
- `test_verify.js` / test files: Automated verification with Playwright
- `.impeccable/`: Impeccable design system artifacts, tokens, and docs
- `FINDINGS.md`: Phase 2 consolidated findings report

## Interface Contracts & Preserved Invariants
- All original global function names and element IDs in `app.js` and `index.html` remain unchanged.
- No Supabase API calls or database schemas altered.
- Codebase remains vanilla JavaScript without modules or frontend framework additions.
- Dark mode toggle remains functional across all views.
- Do NOT use bolder, delight, overdrive, or animate.
- Core application logic contains no code copied from external open-source projects.

