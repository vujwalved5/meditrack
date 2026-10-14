const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const DESKTOP_DIR = path.resolve(__dirname, 'baseline', 'desktop');

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
  await page.clock.install({ time: new Date('2026-10-14T12:00:00Z') });

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

async function verifyRegression() {
  const { server, baseUrl } = await startServer();
  const browser = await chromium.launch({ headless: true });

  let totalChecked = 0;
  let totalMismatches = 0;
  const failures = [];

  console.log('Running Desktop Regression Verification (0 pixel diff required)...');

  try {
    for (const w of WIDTHS) {
      for (const theme of THEMES) {
        for (const p of PAGES) {
          totalChecked++;
          const filename = `${p}-${w}-${theme}.png`;
          const baselinePath = path.join(DESKTOP_DIR, filename);

          if (!fs.existsSync(baselinePath)) {
            failures.push(`Missing baseline: ${filename}`);
            totalMismatches++;
            continue;
          }

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

            // Also check that mobile elements are hidden on desktop (Section 9.1)
            const mobileHiddenCheck = await page.evaluate(() => {
              const selectors = ['#m-app', '.m-nav', '.m-sheet-backdrop', '.m-toast'];
              for (const s of selectors) {
                const els = document.querySelectorAll(s);
                for (const el of els) {
                  const style = window.getComputedStyle(el);
                  if (style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null) {
                    return `Element ${s} is visible on desktop!`;
                  }
                }
              }
              if (document.documentElement.classList.contains('m-boot')) {
                return 'html has m-boot on desktop!';
              }
              return null;
            });

            if (mobileHiddenCheck) {
              failures.push(`${filename}: ${mobileHiddenCheck}`);
              totalMismatches++;
            }

            const currentBuf = await page.screenshot({ fullPage: true });
            const baselineBuf = fs.readFileSync(baselinePath);

            if (Buffer.compare(currentBuf, baselineBuf) !== 0) {
              // Exact buffer diff
              failures.push(`Diff detected in ${filename} (buffer mismatch)`);
              totalMismatches++;
            }
          } catch (err) {
            failures.push(`Error checking ${filename}: ${err.message}`);
            totalMismatches++;
          } finally {
            await context.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\nRegression results: ${totalChecked - totalMismatches}/${totalChecked} passed.`);
  if (totalMismatches > 0) {
    console.error(`FAIL: ${totalMismatches} screenshots mismatched:`);
    failures.forEach(f => console.error('  - ' + f));
    process.exit(1);
  } else {
    console.log('PASS: Exact 0 pixel difference across all 50 desktop baselines!');
  }
}

verifyRegression().catch(err => {
  console.error(err);
  process.exit(1);
});
