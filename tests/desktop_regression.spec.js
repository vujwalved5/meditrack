import { test, expect } from '@playwright/test';

const widths = [768, 1024, 1280, 1440, 1920];
const pages = ['login', 'dashboard', 'dashboard-insights-open', 'audit', 'users'];

async function gotoAs(page, role, pageName, theme) {
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

  await page.goto('/', { waitUntil: 'networkidle' });

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
    document.documentElement.dataset.theme = t;
  }, theme);

  if (pageName === 'login') {
    await page.waitForSelector('#login-screen', { state: 'visible' });
    await page.waitForTimeout(300);
    return;
  }

  await page.waitForSelector('#app-screen', { state: 'visible' });
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

for (const w of widths) {
  for (const theme of ['light', 'dark']) {
    for (const p of pages) {
      test(`desktop ${p} ${w} ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: 900 });
        await gotoAs(page, 'Manager', p, theme);
        await expect(page).toHaveScreenshot(`${p}-${w}-${theme}.png`, {
          fullPage: true,
          maxDiffPixels: 0,
          mask: [page.locator('[data-relative-time]')],
        });
      });
    }
  }
}

test('mobile UI hidden on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoAs(page, 'Manager', 'dashboard', 'light');
  for (const sel of ['#m-app', '.m-nav', '.m-sheet-backdrop', '.m-toast']) {
    for (const el of await page.locator(sel).all()) {
      await expect(el).toBeHidden();
    }
  }
  expect(await page.evaluate(() => document.documentElement.classList.contains('m-boot'))).toBe(false);
});
