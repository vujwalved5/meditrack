# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Hospital staff (nurses, biomedical technicians, ward administrators, clinical engineers) scanning equipment QR codes to check in/out on phone screens in busy wards.

## Product Purpose
MediTrack enables hospital staff to quickly track, check in, and check out medical equipment across hospital rooms and wards using QR code scanning on mobile devices, ensuring equipment availability, accurate location tracking, and rapid turnaround. Calm, trustworthy, and fast.

## Positioning
A lightweight, fast, mobile-first hospital equipment tracker that operates directly in modern mobile browsers in fast-paced clinical environments without requiring native app installations or heavy frameworks.

## Operating Context
Busy hospital wards, emergency departments, ICUs, and biomedical equipment storage rooms. Staff use phone screens (often under fluorescent lighting, one-handed, while wearing gloves or moving between patient bays) to scan equipment QR stickers, select room assignments, and verify status.

## Capabilities and Constraints
- Camera-based QR code scanning with instant decode and fallback manual asset ID input.
- Equipment check-in, check-out, room transfer, and status tracking (Available, In Use, Maintenance, etc.).
- Audit logging for regulatory compliance and equipment location verification.
- User management and role-based access.
- Vanilla JavaScript SPA architecture backed by Supabase REST and Auth APIs.
- Strict constraint: preserve all global function names and element IDs to maintain compatibility with inline handlers.
- Responsive mobile web layout supporting both light and dark modes.

## Brand Commitments
- Name: MediTrack
- Tone: Calm, trustworthy, fast. Professional clinical restraint, high legibility, clean visual feedback, no unnecessary decorative elements.

## Product Principles
1. Speed and reliability above all: scanning and check-in/out flows must be friction-free with immediate feedback.
2. Clinical calm: clear visual hierarchy, solid functional colors, avoiding loud gradients or distracting animations.
3. Fail-safe operation: robust camera permissions handling and seamless fallback to manual entry in non-secure or restricted environments.
4. Accurate accountability: transparent audit logs and unambiguous equipment status indicators.

