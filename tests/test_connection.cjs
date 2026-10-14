const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:4173...');
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });

  console.log('Page title:', await page.title());
  const loginVisible = await page.locator('#login-screen').isVisible();
  console.log('Login screen visible:', loginVisible);

  await browser.close();
}

run().catch(console.error);
