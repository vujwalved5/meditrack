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

function createStaticServer(port = 8082) {
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
    server.listen(port, () => resolve(server));
  });
}

async function capture() {
  const PORT = 8082;
  const server = await createStaticServer(PORT);
  console.log(`Server started on http://localhost:${PORT}`);

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

  const browser = await chromium.launch({ headless: true });

  async function setupPage(viewport, theme) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    await page.route('**/*', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('supabase.co')) {
        if (url.includes('/rest/v1/rpc/login')) {
          const postData = JSON.parse(route.request().postData() || '{}');
          if (postData.password_param && postData.password_param !== 'Admin@123') {
            return route.fulfill({
              status: 400,
              contentType: 'application/json',
              body: JSON.stringify({ message: 'Invalid login credentials' })
            });
          }
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
        if (url.includes('/rest/v1/departments')) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.departments) });
        }
        if (url.includes('/rest/v1/product_types')) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.product_types) });
        }
        if (url.includes('/rest/v1/equipment')) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.equipment) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
      return route.continue();
    });

    await page.goto(`http://localhost:${PORT}`);
    const landingBtn = await page.$('#landing-login-btn');
    if (landingBtn && await landingBtn.isVisible()) {
      await landingBtn.click();
    }
    await page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('meditrack_theme', t);
    }, theme);

    return { context, page };
  }

  const outDir = path.join(ROOT, '.impeccable', 'screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // 1. Desktop Light (1280x800)
  console.log('Capturing Desktop Light...');
  {
    const { context, page } = await setupPage({ width: 1280, height: 800 }, 'light');
    await page.fill('#login-username', 'Admin1');
    await page.fill('#login-password', 'Admin@123');
    await page.click('#login-btn');
    await page.waitForFunction(() => {
      const s = document.getElementById('app-screen');
      return s && getComputedStyle(s).display !== 'none';
    }, { timeout: 10000 });
    await page.waitForSelector('.eq-row', { timeout: 10000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, 'desktop-light.png'), fullPage: true });
    await context.close();
  }

  // 2. Desktop Dark (1280x800)
  console.log('Capturing Desktop Dark...');
  {
    const { context, page } = await setupPage({ width: 1280, height: 800 }, 'dark');
    await page.fill('#login-username', 'Admin1');
    await page.fill('#login-password', 'Admin@123');
    await page.click('#login-btn');
    await page.waitForFunction(() => {
      const s = document.getElementById('app-screen');
      return s && getComputedStyle(s).display !== 'none';
    }, { timeout: 10000 });
    await page.waitForSelector('.eq-row', { timeout: 10000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, 'desktop-dark.png'), fullPage: true });
    await context.close();
  }

  // 3. Mobile 360 Light (360x740)
  console.log('Capturing Mobile 360 Light...');
  {
    const { context, page } = await setupPage({ width: 360, height: 740 }, 'light');
    await page.fill('#login-username', 'Admin1');
    await page.fill('#login-password', 'Admin@123');
    await page.click('#login-btn');
    await page.waitForSelector('#m-app', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, 'mobile-360-light.png'), fullPage: true });
    await context.close();
  }

  // 4. Mobile 360 Dark (360x740)
  console.log('Capturing Mobile 360 Dark...');
  {
    const { context, page } = await setupPage({ width: 360, height: 740 }, 'dark');
    await page.fill('#login-username', 'Admin1');
    await page.fill('#login-password', 'Admin@123');
    await page.click('#login-btn');
    await page.waitForSelector('#m-app', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, 'mobile-360-dark.png'), fullPage: true });
    await context.close();
  }

  await browser.close();
  server.close();
  console.log('✓ All 4 screenshots captured successfully in .impeccable/screenshots/');
}

capture().catch((err) => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
