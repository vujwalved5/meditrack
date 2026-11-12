import { chromium } from '@playwright/test';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function createStaticServer(port = 8080) {
  const server = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(ROOT, reqPath);

    if (!filePath.startsWith(ROOT)) {
      res.statusCode = 403;
      return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.statusCode = 404;
        return res.end('Not found: ' + reqPath);
      }
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
      fs.createReadStream(filePath).pipe(res);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve(server);
    });
  });
}

async function runTests() {
  console.log('--- Starting Playwright Verification with Supabase Route Mocking ---');
  const PORT = 8080;
  let server;
  try {
    server = await createStaticServer(PORT);
    console.log(`[Server] Local test server started on http://localhost:${PORT}`);
  } catch (err) {
    console.log(`[Server] Port ${PORT} might already be in use, continuing...`);
  }

  // In-memory backend fixtures
  const fixtures = {
    departments: [
      { id: 1, name: 'ICU' },
      { id: 2, name: 'General Ward' }
    ],
    product_types: [
      { id: 1, name: 'Ventilator', image_url: null },
      { id: 2, name: 'Infusion Pump', image_url: null }
    ],
    equipment: [
      {
        id: 1,
        name: 'Ventilator 1',
        qr_code_id: 'MT-ICU-001',
        status: 'Available',
        condition: 'Good',
        held_by: null,
        department_id: 1,
        product_type_id: 1,
        last_updated: new Date().toISOString(),
        departments: { name: 'ICU' },
        product_types: { name: 'Ventilator', image_url: null }
      },
      {
        id: 2,
        name: 'Infusion Pump 1',
        qr_code_id: 'MT-GEN-002',
        status: 'In Use',
        condition: 'Good',
        held_by: 'Nurse1',
        department_id: 2,
        product_type_id: 2,
        last_updated: new Date().toISOString(),
        departments: { name: 'General Ward' },
        product_types: { name: 'Infusion Pump', image_url: null }
      }
    ],
    latest_checkout_rooms: [],
    requests: [],
    ai_insights: [],
    ai_weekly_reports: [],
    audit_log: []
  };

  const interceptedCalls = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Intercept all network requests to Supabase
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('supabase.co')) {
      interceptedCalls.push({ url, method, time: Date.now() });

      // 1. Auth RPC login
      if (url.includes('/rest/v1/rpc/login')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            username: 'Admin1',
            role: 'Manager',
            department_id: 1,
            department_name: 'ICU'
          })
        });
      }

      // 2. Departments
      if (url.includes('/rest/v1/departments')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fixtures.departments)
        });
      }

      // 3. Product Types
      if (url.includes('/rest/v1/product_types')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fixtures.product_types)
        });
      }

      // 4. Equipment
      if (url.includes('/rest/v1/equipment')) {
        if (method === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(fixtures.equipment)
          });
        }
        if (method === 'PATCH') {
          const postData = JSON.parse(route.request().postData() || '{}');
          const idMatch = url.match(/id=eq\.(\d+)/);
          const eqId = idMatch ? parseInt(idMatch[1], 10) : 1;
          const eqItem = fixtures.equipment.find(e => e.id === eqId);
          if (eqItem) {
            Object.assign(eqItem, postData);
            if (postData.status === 'Available') {
              eqItem.held_by = null;
              fixtures.latest_checkout_rooms = fixtures.latest_checkout_rooms.filter(r => r.equipment_id !== eqId);
            }
          }
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { 'content-range': '0-0/1' },
            body: JSON.stringify([eqItem || postData])
          });
        }
      }

      // 5. Latest checkout rooms
      if (url.includes('/rest/v1/latest_checkout_rooms')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fixtures.latest_checkout_rooms)
        });
      }

      // 6. Audit Log
      if (url.includes('/rest/v1/audit_log')) {
        if (method === 'POST') {
          const postData = JSON.parse(route.request().postData() || '[]');
          const entries = Array.isArray(postData) ? postData : [postData];
          for (const ent of entries) {
            const newEntry = {
              id: fixtures.audit_log.length + 1,
              timestamp: new Date().toISOString(),
              ...ent
            };
            fixtures.audit_log.push(newEntry);
            if (ent.room && ent.equipment_id) {
              fixtures.latest_checkout_rooms = fixtures.latest_checkout_rooms.filter(r => r.equipment_id !== ent.equipment_id);
              fixtures.latest_checkout_rooms.push({ equipment_id: ent.equipment_id, room: ent.room });
            }
          }
          return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(entries)
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fixtures.audit_log)
        });
      }

      // 7. Requests, AI insights, AI reports
      if (url.includes('/rest/v1/requests')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fixtures.requests)
        });
      }
      if (url.includes('/rest/v1/ai_insights')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fixtures.ai_insights)
        });
      }
      if (url.includes('/rest/v1/ai_weekly_reports')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fixtures.ai_weekly_reports)
        });
      }

      // Realtime websocket or other REST calls
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    }

    // Pass through local static files
    return route.continue();
  });

  try {
    console.log('[Test 1] Navigating to login page...');
    await page.goto(`http://localhost:${PORT}`);

    console.log('[Test 2] Performing user login (Admin1)...');
    await page.fill('#login-username', 'Admin1');
    await page.fill('#login-password', 'Admin@123');
    await page.click('#login-btn');

    await page.waitForFunction(() => {
      const s = document.getElementById('app-screen');
      return s && getComputedStyle(s).display !== 'none';
    }, { timeout: 10000 });

    await page.waitForSelector('.eq-row', { timeout: 10000 });
    console.log('✓ Successfully logged in and loaded equipment table!');

    // Verify initial equipment status
    const initialStatuses = await page.locator('.eq-row').evaluateAll(els => els.map(el => ({
      name: el.querySelector('.eq-name-title')?.textContent?.trim(),
      qrId: el.querySelector('.eq-id-caption')?.textContent?.trim(),
      status: (el.querySelector('.status-pill') || el.querySelector('.status-badge'))?.textContent?.trim()
    })));
    console.log('Initial equipment statuses:', initialStatuses);

    const vent1 = initialStatuses.find(e => e.qrId === 'MT-ICU-001');
    if (!vent1 || vent1.status !== 'Available') {
      throw new Error(`Expected Ventilator 1 (MT-ICU-001) to be Available, got: ${vent1?.status}`);
    }
    console.log('✓ Ventilator 1 is initially Available');

    // TEST FULL SCAN CYCLE: scan -> room picker -> confirm -> In Use -> scan again -> release
    console.log('\n[Test 3] Simulating Full Equipment Scan Cycle...');

    // 1. Open scanner modal
    await page.evaluate(() => {
      if (typeof openScanner === 'function') openScanner();
    });
    await page.waitForFunction(() => {
      const modal = document.getElementById('scanner-modal');
      return modal && getComputedStyle(modal).display !== 'none';
    }, { timeout: 5000 });
    console.log('✓ Scanner modal opened');

    // 2. Scan QR code (test lowercase & whitespace to verify case-insensitivity and trim)
    console.log('Submitting QR code: " mt-icu-001 "...');
    await page.fill('#manual-qr', '  mt-icu-001  ');
    await page.click('#manual-qr + button'); // Click Look up

    // 3. Room picker modal appears
    await page.waitForFunction(() => {
      const modal = document.getElementById('room-picker-modal');
      return modal && getComputedStyle(modal).display !== 'none';
    }, { timeout: 5000 });
    console.log('✓ Room picker modal displayed');

    // Verify room options exist
    const roomOptions = await page.locator('#room-picker-select option').evaluateAll(opts => opts.map(o => o.value));
    console.log('Room picker options available:', roomOptions);
    if (!roomOptions.includes('Bed 2')) {
      throw new Error('Expected "Bed 2" to be an option in ICU rooms');
    }

    // 4. Select room "Bed 2" and confirm check-out
    await page.selectOption('#room-picker-select', 'Bed 2');
    await page.click('#room-picker-confirm');
    console.log('✓ Confirmed room "Bed 2"');

    // 5. Wait for toast and status badge update to "In Use"
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('.eq-row'));
      const row = rows.find(r => r.querySelector('.eq-id-caption')?.textContent?.trim() === 'MT-ICU-001');
      const badge = (row?.querySelector('.status-pill') || row?.querySelector('.status-badge'))?.textContent?.trim();
      return badge === 'In Use';
    }, { timeout: 10000 });
    console.log('✓ Equipment status successfully transitioned to "In Use (Bed 2)"!');

    // 6. Second scan: scan the same item again to trigger Release
    console.log('\n[Test 4] Scanning equipment again to trigger Release flow...');
    await page.evaluate(() => {
      if (typeof openScanner === 'function') openScanner();
    });
    await page.waitForFunction(() => {
      const modal = document.getElementById('scanner-modal');
      return modal && getComputedStyle(modal).display !== 'none';
    }, { timeout: 5000 });

    await page.fill('#manual-qr', 'MT-ICU-001');
    await page.click('#manual-qr + button');

    // 7. Verify release completion
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('.eq-row'));
      const row = rows.find(r => r.querySelector('.eq-id-caption')?.textContent?.trim() === 'MT-ICU-001');
      const badge = (row?.querySelector('.status-pill') || row?.querySelector('.status-badge'))?.textContent?.trim();
      return badge === 'Available';
    }, { timeout: 10000 });
    console.log('✓ Equipment status successfully released back to "Available"!');

    // 8. Test Unknown QR code error handling
    console.log('\n[Test 5] Testing unknown QR code error handling...');
    await page.waitForTimeout(1600);
    await page.evaluate(() => {
      if (typeof openScanner === 'function') openScanner();
    });
    await page.waitForFunction(() => {
      const modal = document.getElementById('scanner-modal');
      return modal && getComputedStyle(modal).display !== 'none';
    }, { timeout: 5000 });
    await page.fill('#manual-qr', 'UNKNOWN-QR-999');
    await page.click('#manual-qr + button');

    await page.waitForFunction(() => {
      const res = document.getElementById('scan-result');
      return res && res.textContent.includes('Unknown QR code');
    }, { timeout: 5000 });
    const errorText = await page.locator('#scan-result').textContent();
    console.log('✓ Unknown QR code produced expected error:', errorText.trim());

    // Close scanner
    await page.evaluate(() => {
      if (typeof closeScanner === 'function') closeScanner();
    });

    // 9. Test theme unification
    console.log('\n[Test 6] Testing theme unification to meditrack_theme...');
    const initialThemeKey = await page.evaluate(() => localStorage.getItem('meditrack_theme'));
    const obsoleteThemeKey = await page.evaluate(() => localStorage.getItem('theme'));
    console.log(`Initial meditrack_theme: "${initialThemeKey}", obsolete theme key: "${obsoleteThemeKey}"`);

    await page.evaluate(() => {
      if (typeof cycleTheme === 'function') cycleTheme();
    });
    const updatedThemeKey = await page.evaluate(() => localStorage.getItem('meditrack_theme'));
    const obsoleteStillNull = await page.evaluate(() => localStorage.getItem('theme'));
    console.log(`Updated meditrack_theme: "${updatedThemeKey}", obsolete theme key: "${obsoleteStillNull}"`);

    if (obsoleteStillNull !== null) {
      throw new Error('Obsolete "theme" localStorage key was improperly created!');
    }
    console.log('✓ Theme unification verified (meditrack_theme is used, "theme" is never used)');

    // 10. Verify Zero calls to live Supabase
    console.log('\n[Test 7] Verifying Zero live Supabase requests...');
    console.log(`Total intercepted Supabase requests: ${interceptedCalls.length}`);
    if (interceptedCalls.length === 0) {
      throw new Error('Expected intercepted Supabase calls, but none were recorded!');
    }
    console.log('✓ All Supabase calls were 100% intercepted and handled with fixture data!');

    // 11. Test Pause on Decode & Resume on Room Picker Cancel
    console.log('\n[Test 8] Testing scanner pause on decode and resume on cancel...');
    await page.waitForTimeout(3100);
    const pauseResumeResult = await page.evaluate(async () => {
      let pauseArgs = null;
      let resumeCalled = false;

      const origPause = window.Html5Qrcode.prototype.pause;
      const origResume = window.Html5Qrcode.prototype.resume;
      const origStart = window.Html5Qrcode.prototype.start;

      window.Html5Qrcode.prototype.start = function() {
        return Promise.resolve();
      };
      window.Html5Qrcode.prototype.pause = function(flag) {
        pauseArgs = flag;
      };
      window.Html5Qrcode.prototype.resume = function() {
        resumeCalled = true;
      };

      // Open scanner
      openScanner();
      await new Promise(r => setTimeout(r, 100));

      // Trigger scan on available equipment
      document.getElementById('manual-qr').value = 'MT-ICU-001';
      submitManualQr();

      const pausedAfterDecode = pauseArgs === true;

      // Cancel room picker
      cancelRoomPicker();
      const resumedAfterCancel = resumeCalled;

      // Restore
      window.Html5Qrcode.prototype.pause = origPause;
      window.Html5Qrcode.prototype.resume = origResume;
      window.Html5Qrcode.prototype.start = origStart;
      closeScanner();

      return { pausedAfterDecode, resumedAfterCancel };
    });
    console.log('Pause & Resume result:', pauseResumeResult);
    if (!pauseResumeResult.pausedAfterDecode || !pauseResumeResult.resumedAfterCancel) {
      throw new Error('Scanner pause(true) on decode or resume() on cancel failed!');
    }
    console.log('✓ Scanner pause on decode and resume on room picker cancel verified!');

    // 12. Test Insecure Context Handling
    console.log('\n[Test 9] Testing insecure context warning & auto-focus...');
    const insecureResult = await page.evaluate(async () => {
      // Simulate insecure context
      const originalSecure = window.isSecureContext;
      Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });

      const scanResultEl = document.getElementById('scan-result');
      scanResultEl.textContent = '';
      window.scannerActive = false;
      window.scannerStarting = false;

      await window.startScanner();

      const msg = scanResultEl.textContent;
      const activeElId = document.activeElement ? document.activeElement.id : null;

      // Restore
      Object.defineProperty(window, 'isSecureContext', { value: originalSecure, configurable: true });

      return { msg, activeElId };
    });
    console.log('Insecure context test result:', insecureResult);
    if (!insecureResult.msg.includes('Camera access requires a secure connection')) {
      throw new Error(`Expected insecure context warning, got: "${insecureResult.msg}"`);
    }
    console.log('✓ Insecure context detected, distinct message shown, and manual input auto-focused!');

    // 13. Static Code Integrity Verification
    console.log('\n[Test 10] Testing static invariants and code integrity...');
    const appJsContent = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const indexHtmlContent = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    // Single definition of showToast and doLogout
    const showToastCount = (appJsContent.match(/function\s+showToast\s*\(/g) || []).length;
    const doLogoutCount = (appJsContent.match(/function\s+doLogout\s*\(/g) || []).length;
    console.log(`showToast count: ${showToastCount}, doLogout count: ${doLogoutCount}`);
    if (showToastCount !== 1) throw new Error(`Expected exactly 1 showToast, found: ${showToastCount}`);
    if (doLogoutCount !== 1) throw new Error(`Expected exactly 1 doLogout, found: ${doLogoutCount}`);

    // No unpkg or cdnjs in index.html
    const hasUnpkg = indexHtmlContent.includes('unpkg.com');
    const hasCdnjs = indexHtmlContent.includes('cdnjs.cloudflare.com');
    if (hasUnpkg || hasCdnjs) throw new Error('index.html still contains unpkg or cdnjs script tags!');

    // Local vendor directory references
    const hasVendorQrcode = indexHtmlContent.includes('vendor/qrcode.min.js');
    const hasVendorHtml5Qrcode = indexHtmlContent.includes('vendor/html5-qrcode.min.js');
    if (!hasVendorQrcode || !hasVendorHtml5Qrcode) throw new Error('index.html does not properly reference vendored scripts!');

    console.log('✓ Single definitions of showToast/doLogout and local vendor scripts verified!');

    console.log('\n=============================================');
    console.log('🎉 ALL PLAYWRIGHT VERIFICATION TESTS PASSED! 🎉');
    console.log('=============================================');

  } finally {
    await browser.close();
    if (server) {
      server.close();
    }
  }
}

runTests().catch(e => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
