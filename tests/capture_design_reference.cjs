const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DESIGN_FILE = 'file:///' + path.resolve(__dirname, '..', 'docs', 'mobile', 'meditrack_mobile_ui_design.html').replace(/\\/g, '/');
const REF_DIR = path.resolve(__dirname, '..', 'docs', 'mobile', 'reference');
fs.mkdirSync(REF_DIR, { recursive: true });

async function captureReferences() {
  console.log('Capturing design reference screenshots from prototype...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  await page.goto(DESIGN_FILE, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const phone = page.locator('#interactive-phone');

  // Helper to capture phone element
  async function snap(name) {
    const filename = `${name}.png`;
    await phone.screenshot({ path: path.join(REF_DIR, filename) });
    console.log(`Saved reference: ${filename}`);
  }

  // 1. Roles & Home tab
  for (const role of ['Manager', 'Senior Doctor', 'Staff']) {
    for (const theme of ['light', 'dark']) {
      await page.selectOption('#sim-role', role);
      // Ensure phone theme matches
      const currentTheme = await page.locator('#interactive-phone').getAttribute('data-phone-theme');
      if (currentTheme !== theme) {
        await page.click('#phone-theme-btn');
      }
      await page.waitForTimeout(150);
      await snap(`ref-home-${role.toLowerCase().replace(/\s+/g, '-')}-${theme}`);
    }
  }

  // Switch back to Manager Light for micro-flows
  await page.selectOption('#sim-role', 'Manager');
  const currentTheme = await page.locator('#interactive-phone').getAttribute('data-phone-theme');
  if (currentTheme !== 'light') {
    await page.click('#phone-theme-btn');
  }

  // 2. Tabs
  for (const tab of ['requests', 'audit', 'more']) {
    await page.evaluate((t) => window.switchPhoneTab(t), tab);
    await page.waitForTimeout(200);
    await snap(`ref-tab-${tab}`);
  }

  // 3. Equipment Sheet
  await page.evaluate(() => {
    window.switchPhoneTab('home');
    window.openDetailSheet(1);
  });
  await page.waitForTimeout(300);
  await snap('ref-sheet-equipment-avail');

  await page.evaluate(() => {
    window.openDetailSheet(2); // in use
  });
  await page.waitForTimeout(300);
  await snap('ref-sheet-equipment-inuse');
  await page.evaluate(() => window.closeDetailSheet());

  // 4. Scanner sheet
  await page.evaluate(() => window.openMobileScanner());
  await page.waitForTimeout(300);
  await snap('ref-sheet-scanner-room-chips');
  await page.evaluate(() => window.closeMobileScanner());

  await browser.close();
  console.log('Design references captured!');
}

captureReferences().catch(console.error);
