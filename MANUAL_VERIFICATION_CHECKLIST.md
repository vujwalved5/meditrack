# MediTrack: Real-World Phone Verification Checklist (Clarification C5)

This checklist is designed for clinical ward staff (nurses, biomedical technicians, ward charge nurses) and QA auditors to verify MediTrack on real mobile hardware (iOS Safari & Android Chrome) under live clinical conditions.

---

## 1. Test Environment Prerequisites
- [ ] **Secure Protocol**: Verify the application is served over `https://` (or `http://localhost:` for staging). Note: Camera hardware access is blocked by iOS and Android security sandboxes on unencrypted HTTP.
- [ ] **Tested Devices & Browsers**:
  - **iOS**: iPhone 11 or newer running iOS Safari (WebKit engine).
  - **Android**: Pixel / Samsung Galaxy / Zebra medical handheld running Android Chrome.
- [ ] **Staff Permissions**: Valid ward login credentials (e.g., Manager, Doctor, or Staff user).

---

## 2. Real Camera Permission & Optical QR Scan Flow
1. **Launch Scanner**:
   - [ ] Tap the primary floating **Scan** button in the bottom navigation bar (or the header **Scan QR** button).
2. **System Permission Prompt**:
   - [ ] On first launch, the browser should display the native OS permission prompt: *"meditrack wants to use your camera"*.
   - [ ] Tap **Allow** (or **While Using the App**).
3. **Optical Viewfinder & Framing**:
   - [ ] Confirm camera feed streams fluidly inside the modal viewfinder without lag or distortion.
   - [ ] Point the phone camera at a printed equipment QR code sticker (e.g., `MT-ICU-001` or `MT-GEN-002`).
4. **Pause on Decode**:
   - [ ] Upon successful optical recognition, observe that the camera viewfinder immediately pauses/freezes (`html5Scanner.pause(true)`).
   - [ ] Confirm the room picker modal promptly slides in over the scanner.

---

## 3. Room Picker & Check-Out Verification
1. **Room Selection**:
   - [ ] Verify the Room Picker modal displays the correct department rooms (e.g., *Bed 1*, *Bed 2*, *Nurses' Station*, *Other*).
   - [ ] Tap the dropdown to select a clinical location (e.g., *Bed 2*).
2. **Confirm Check-Out**:
   - [ ] Tap the blue **Confirm Check-Out** button (minimum 44×44px touch target for gloved operation).
   - [ ] Observe the green confirmation toast message: *"Equipment assigned to Bed 2"*.
   - [ ] Observe that the equipment status row in the dashboard updates immediately to **In Use** with *Bed 2* indicated.
3. **Scanner Cleanup**:
   - [ ] Confirm the camera scanner has stopped and camera indicator LED on the phone turns off.

---

## 4. Optical Scan Release Flow (Return to Available)
1. **Re-scan Assigned Equipment**:
   - [ ] Tap **Scan** again and point the camera at the same equipment QR sticker (or enter ID).
2. **Release Prompt**:
   - [ ] Notice the modal recognizes the equipment is currently *In Use*.
   - [ ] Tap **Release Equipment** (or confirm return).
3. **Status Verification**:
   - [ ] Observe confirmation toast: *"Equipment released to Available"*.
   - [ ] Confirm equipment status pill transitions back to **Available** (calm green).

---

## 5. Insecure Context & Permission Denied Manual Fallback
1. **Camera Denied or Insecure Connection**:
   - [ ] In browser settings, temporarily set camera permission to *Block*, or access via plain `http://` (non-secure context).
   - [ ] Tap **Scan**.
2. **Informative In-Modal Notice**:
   - [ ] Verify an informative warning displays: *"Camera access requires a secure connection (HTTPS or localhost). Please enter the asset ID manually below."* (or *"Camera permission denied"*).
   - [ ] Verify the cursor automatically focuses into the **Manual Asset ID** text input field.
3. **Case & Whitespace Resilient Manual Entry**:
   - [ ] Type an asset ID with irregular casing and extra spaces (e.g., `  mt-icu-001  `).
   - [ ] Tap **Look up**.
   - [ ] Confirm the equipment is matched successfully and opens the check-out/release flow without errors.
4. **Unknown QR Code Handling**:
   - [ ] Enter a nonexistent code (e.g., `UNKNOWN-999`) and tap **Look up**.
   - [ ] Verify distinct, friendly clinical feedback: *"Unknown QR code: "UNKNOWN-999" — not found in system."*

---

## 6. Ward Ergonomics, Lighting & Themes
1. **Theme Switcher**:
   - [ ] Toggle the theme icon in the header (or avatar profile menu).
   - [ ] In **Light Mode** (bright ward daylight): Confirm high contrast, crisp typography, and non-glare status pills.
   - [ ] In **Dark Mode** (night shift rounds): Confirm deep slate surfaces (`#0F1012`, `#1B1C1F`), zero electric glows, soft blue accents, and readable text contrast.
2. **Gloved Touch Targets**:
   - [ ] Confirm every interactive button, filter chip, and modal action is easily tappable with one hand and gloved fingers (≥ 44×44px).
3. **Network Resilience**:
   - [ ] Place device in Airplane mode briefly while viewing cached table; confirm graceful offline indicator without crashing the SPA.
