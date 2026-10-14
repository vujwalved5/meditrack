const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const DESKTOP_DIR = path.resolve(__dirname, 'baseline', 'desktop');
const MOBILE_BEFORE_DIR = path.resolve(__dirname, 'baseline', 'mobile-before');

fs.mkdirSync(DESKTOP_DIR, { recursive: true });
fs.mkdirSync(MOBILE_BEFORE_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function startServer() {
  return new Promise((resolve, reject) => {
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
          return res.end('Not found');
        }
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
      });
    });

    server.listen(0, () => {
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}`;
      console.log(`Embedded static server running on free port ${port} (${baseUrl})`);
      resolve({ server, port, baseUrl });
    });

    server.on('error', reject);
  });
}

const WIDTHS = [768, 1024, 1280, 1440, 1920];
const THEMES = ['light', 'dark'];
const PAGES = ['login', 'dashboard', 'dashboard-insights-open', 'audit', 'users'];

async function setupPage(page, baseUrl, { role = 'Manager', pageName = 'dashboard', theme = 'light', width = 1280, height = 900 }) {
  await page.setViewportSize({ width, height });

  // Freeze time for deterministic timestamps
  await page.clock.install({ time: new Date('2026-10-14T12:00:00Z') });

  // Pre-seed localStorage before navigation
  await page.addInitScript(({ role, theme, pageName }) => {
    localStorage.clear();
    localStorage.setItem('theme', theme);
    localStorage.setItem('meditrack_theme', theme);
    if (pageName !== 'login') {
      const user = role === 'Manager'
        ? { id: 1, username: 'admin', role: 'Manager', department_id: null }
        : role === 'Senior Doctor'
          ? { id: 4, username: 'vinayaka', role: 'Senior Doctor', department_id: 1 }
          : { id: 2, username: 'raju', role: 'Staff', department_id: 2 };
      localStorage.setItem('meditrack_session', JSON.stringify(user));
    }
  }, { role, theme, pageName });

  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });

  // Disable animations and transitions for pixel-perfect diffing
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      .duration-live, [data-relative-time] {
        visibility: hidden !important;
      }
    `
  });

  // Ensure theme is applied on root
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
    if (t === 'dark') {
      document.documentElement.dataset.theme = 'dark';
    } else {
      document.documentElement.dataset.theme = 'light';
    }
  }, theme);

  if (pageName === 'login') {
    await page.waitForSelector('#login-screen', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(300);
    return;
  }

  // For app pages, wait for app screen and equipment list
  await page.waitForSelector('#app-screen', { state: 'visible', timeout: 10000 });
  await page.waitForSelector('.eq-row-line, .eq-table-row, .empty-state', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);

  if (pageName === 'dashboard-insights-open') {
    const toggle = page.locator('#ai-insights-toggle, #btn-toggle-insights, .ai-insights-toggle');
    if (await toggle.count() > 0 && await toggle.first().isVisible()) {
      await toggle.first().click();
      await page.waitForTimeout(400);
    } else {
      await page.evaluate(() => {
        const grid = document.getElementById('ai-cards-grid');
        if (grid) grid.style.display = 'grid';
        const sec = document.getElementById('ai-insights-section');
        if (sec) sec.classList.remove('collapsed');
      });
      await page.waitForTimeout(300);
    }
  } else if (pageName === 'audit') {
    await page.evaluate(() => {
      if (typeof showPage === 'function') showPage('auditlog');
    });
    await page.waitForSelector('#page-auditlog.active', { state: 'visible', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
  } else if (pageName === 'users') {
    await page.evaluate(() => {
      if (typeof showPage === 'function') showPage('users');
    });
    await page.waitForSelector('#page-users.active', { state: 'visible', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
  }
}

async function captureDesktopBaselines(browser, baseUrl) {
  console.log('Capturing Desktop Baselines across 5 widths, 2 themes, 5 pages...');

  for (const w of WIDTHS) {
    for (const theme of THEMES) {
      for (const p of PAGES) {
        const filename = `${p}-${w}-${theme}.png`;
        const filepath = path.join(DESKTOP_DIR, filename);

        const context = await browser.newContext();
        const page = await context.newPage();

        try {
          await setupPage(page, baseUrl, {
            role: 'Manager',
            pageName: p,
            theme: theme,
            width: w,
            height: 900
          });

          await page.screenshot({
            path: filepath,
            fullPage: true
          });
          console.log(`Saved desktop baseline: ${filename}`);
        } catch (err) {
          console.error(`Error capturing ${filename}:`, err.message);
        } finally {
          await context.close();
        }
      }
    }
  }
}

async function captureMobileBefore(browser, baseUrl) {
  console.log('Capturing Mobile Before screenshots at 390x844 and 360x640...');
  const viewports = [
    { name: '390x844', width: 390, height: 844 },
    { name: '360x640', width: 360, height: 640 }
  ];

  for (const vp of viewports) {
    for (const theme of THEMES) {
      for (const role of ['Manager', 'Senior Doctor', 'Staff']) {
        const filename = `mobile-before-${role.toLowerCase().replace(/\s+/g, '-')}-${vp.name}-${theme}.png`;
        const filepath = path.join(MOBILE_BEFORE_DIR, filename);

        const context = await browser.newContext({
          isMobile: true,
          hasTouch: true
        });
        const page = await context.newPage();

        try {
          await setupPage(page, baseUrl, {
            role,
            pageName: 'dashboard',
            theme,
            width: vp.width,
            height: vp.height
          });

          await page.screenshot({
            path: filepath,
            fullPage: true
          });
          console.log(`Saved mobile before: ${filename}`);
        } catch (err) {
          console.error(`Error capturing ${filename}:`, err.message);
        } finally {
          await context.close();
        }
      }
    }
  }
}

async function main() {
  const { server, baseUrl } = await startServer();
  const browser = await chromium.launch({ headless: true });

  try {
    await captureDesktopBaselines(browser, baseUrl);
    await captureMobileBefore(browser, baseUrl);
    console.log('Phase 0 baseline capture completed successfully!');
  } finally {
    await browser.close();
    server.close();
    console.log('Server closed');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
