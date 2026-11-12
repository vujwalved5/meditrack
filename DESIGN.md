---
name: MediTrack Design System
description: Calm, trustworthy, and fast hospital equipment management system
colors:
  primary: "#2F5BEA"
  primary-strong: "#2548C4"
  primary-tint: "#E9EEFD"
  neutral-bg: "#F3F4F6"
  surface: "#FFFFFF"
  surface-2: "#F7F8FA"
  border: "#E8EAEE"
  text: "#14161A"
  text-2: "#5B616B"
  text-3: "#8B919B"
  success: "#16A34A"
  success-tint: "#E7F6EC"
  danger: "#DC2626"
  danger-tint: "#FDECEC"
  warning: "#D97706"
  warning-tint: "#FEF3E2"
  neutral: "#6B7280"
  neutral-tint: "#EEF0F3"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "10px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "40px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
---

# Design System

<!-- impeccable:design-schema 1 -->

## Overview
MediTrack's design system is engineered for busy hospital staff operating mobile phones in high-stress, fast-paced clinical environments. The interface embodies clinical calm, immediate clarity, and rock-solid trustworthiness. Visual choices prioritize rapid scanning, high-contrast legibility under varied hospital lighting, and frictionless touch interactions.

## Colors
- **Primary / Brand**: `#2F5BEA` (dark: `#4F7BFF`) provides a calm, authoritative medical blue for primary actions and active navigation states.
- **Surfaces & Background**: Neutral cool grays (`#F3F4F6` background, `#FFFFFF` cards, `#F7F8FA` secondary surfaces) in light mode; deep slate tones (`#0F1012` bg, `#1B1C1F` surface) in dark mode.
- **Status Vocabulary**:
  - Available: Green (`#16A34A` / tint `#E7F6EC`)
  - In Use: Red/Crimson (`#DC2626` / tint `#FDECEC`)
  - Warning/Maintenance: Amber (`#D97706` / tint `#FEF3E2`)
  - Neutral/Retired: Gray (`#6B7280` / tint `#EEF0F3`)
- **Text & Contrast**: High-contrast dark charcoal (`#14161A`) for body text, muted secondary slate (`#5B616B`) for metadata, and tertiary gray (`#8B919B`) for subtle hints.

## Typography
- **Typeface**: Single considered typeface family — clean system UI stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` (zero CDN latency, zero FOUT layout shift, high legibility on hospital ward devices).
- **Scale**:
  - Page Titles: `1.5rem` – `1.75rem` (`700` weight)
  - Section Headers / Modal Titles: `1.125rem` – `1.25rem` (`600` weight)
  - Card Titles & Equipment Names: `1rem` (`600` weight)
  - Body & Form Controls: `0.875rem` (`400`–`500` weight)
  - Badges, Timestamps, Labels: `0.75rem` (`500`–`600` weight)

## Layout
- Mobile-first, single-column orientation optimized for one-handed thumb interaction on 360px–430px smartphone viewports, scaling cleanly to tablet and desktop.
- Generous touch targets (minimum 44x44px for primary buttons and touch controls).
- Sticky navigation headers and compact bottom navigation tabs for rapid switching.
- High visual grouping density without visual clutter: equipment cards cleanly encapsulate asset ID, location, status badge, and quick actions.

## Elevation & Depth
- Flat, calm, tonal layering over heavy drop shadows.
- Cards use subtle single-pixel border definitions (`#E8EAEE`) and delicate ambient elevation (`0 1px 2px rgba(16, 24, 40, 0.05)`).
- Modals, action sheets, and scanner overlays use crisp backdrops (`rgba(0, 0, 0, 0.6)`) to focus user attention entirely on scanning and confirmation.

## Shapes
- Controls: `10px` border-radius (`--r-ctl`) for buttons, inputs, and selects.
- Cards & Containers: `16px` border-radius (`--r-card`).
- Status Badges & Pills: `999px` fully rounded pill shape (`--r-pill`).

## Components
- **QR Scanner Modal**: Centered viewport with clear viewfinder overlay, instant status messaging, fallback manual asset ID input, and pause/resume control.
- **Room Picker Modal**: Rapid selection list of wards and room numbers with one-tap confirmation.
- **Equipment Card**: Compact card showing equipment icon, asset ID, model/name, current room, status pill, and action buttons (Check Out / Check In).
- **Status Pills**: Solid semantic background tint with high-contrast text and dot indicators.
- **Form Controls**: Crisp borders with 2px primary focus rings for accessibility and screen-reader friendliness.

## Do's and Don'ts
### Do's
- Prioritize scan speed and clarity above visual ornamentation.
- Use explicit SVG icons from the sprite sheet with clear semantic labels.
- Provide distinct, human-readable error messages for all camera and network states.
- Maintain seamless touch targets and immediate visual feedback on taps.

### Don'ts
- Do not use decorative gradients, glow effects, or playful animations.
- Do not hide critical equipment details behind complex multi-level menus.
- Do not rely solely on color to communicate equipment status (always include text labels).
- Do not rename existing global JS functions or DOM element IDs.

