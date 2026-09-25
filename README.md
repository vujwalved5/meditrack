# MediTrack - Hospital Equipment Tracking System

A real-time hospital equipment visibility prototype with QR-based status updates,
user authentication, and role-based access control.

## Default Login Credentials

  Username:  admin
  Password:  Admin@1234

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
  - Supabase Auth (JWT tokens) can replace the sessionStorage approach

## Database Schema

Tables:
  departments   - ICU, General Ward, Emergency
  equipment     - 8 items (ventilators, wheelchairs, infusion pumps, defibrillator, monitor)
  requests      - equipment requests with Normal/Urgent priority
  audit_log     - full history of all status changes (records real logged-in username)
  users         - accounts with bcrypt-hashed passwords and role assignments

SQL Files:
  schema.sql        - original tables + seed data + Realtime + RLS
  schema_auth.sql   - users table + RLS + admin seed account

## Supabase Configuration

Project URL: https://qfgvjyhnvmcczhqicend.supabase.co
Anon Key: embedded in index.html (safe for public demos)
Realtime: enabled on equipment and requests tables
RLS: configured for anonymous access (demo mode)

## Tech Stack

  Frontend:       Vanilla HTML5, CSS3, JavaScript (no framework, no build step)
  Backend/DB:     Supabase (Postgres + REST + Realtime)
  Authentication: Client-side bcryptjs (CDN) + sessionStorage session
  QR Generation:  qrcodejs (CDN)
  QR Scanning:    html5-qrcode (CDN)
  Fonts:          Inter (Google Fonts)

## Files

  index.html         Complete single-page application (auth + RBAC + all equipment features)
  schema.sql         Original tables, seed data, Realtime, RLS
  schema_auth.sql    Users table, RLS, admin seed account
  README.md          This file

## Out of Scope

The following features are intentionally not implemented:
  - Server-side authentication / JWT / Supabase Auth
  - Push notifications
  - Booking time slots
  - Maintenance scheduling
  - Human-resource conflict handling
