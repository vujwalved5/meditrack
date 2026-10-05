// scripts/verify_bug3_proof.js
import fs from 'fs';

async function main() {
  const tabs = await fetch('http://localhost:9222/json/list').then(r => r.json());
  const pageTab = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  let id = 1;
  const callbacks = new Map();
  const consoleErrors = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map(a => a.value || a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''));
    }
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg);
      callbacks.delete(msg.id);
    }
  };

  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = id++;
    callbacks.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');

  console.log('--- TEST 1: Direct navigation & hard refresh on Audit Log page ---');
  await send('Page.navigate', { url: 'http://localhost:8085/#auditlog' });
  await send('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 2000));
  consoleErrors.length = 0; // Clear errors from previous session/unload

  // If page is not on auditlog, navigate to it
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        if (typeof navigateTo === 'function') navigateTo('auditlog');
        else if (typeof showPage === 'function') showPage('auditlog');
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1000));

  // TEST 2: Inspect initial rendered state with no filters
  console.log('\n--- TEST 2: No filters rendered state & pagination check ---');
  const checkInitial = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `
      (() => {
        const rows = Array.from(document.querySelectorAll('.audit-eq-row'));
        const pagInfo = document.querySelector('#audit-pagination .pagination-info');
        const header = document.querySelector('.audit-table-header');
        const headerCells = header ? Array.from(header.children).map(c => ({
          text: c.textContent.trim(),
          left: Math.round(c.getBoundingClientRect().left),
          width: Math.round(c.getBoundingClientRect().width)
        })) : [];

        const firstFewRows = rows.slice(0, 5).map((r, i) => {
          const h = r.querySelector('.audit-eq-row-header');
          const cells = h ? Array.from(h.children).map(c => ({
            text: c.textContent.trim(),
            left: Math.round(c.getBoundingClientRect().left),
            width: Math.round(c.getBoundingClientRect().width)
          })) : [];
          return {
            index: i + 1,
            id: r.id,
            cells
          };
        });

        // Find a never used item in the list
        const neverUsedRow = rows.find(r => {
          const uses = r.querySelector('.audit-eq-uses');
          return uses && uses.textContent.trim() === '0';
        });
        const neverUsedData = neverUsedRow ? {
          name: neverUsedRow.querySelector('.audit-eq-name')?.textContent.trim(),
          uses: neverUsedRow.querySelector('.audit-eq-uses')?.textContent.trim(),
          lastAct: neverUsedRow.querySelector('.audit-eq-last-act')?.textContent.trim(),
          lastUser: neverUsedRow.querySelector('.audit-eq-last-user')?.textContent.trim()
        } : null;

        return {
          totalEquipment: typeof allEquipment !== 'undefined' ? allEquipment.length : 0,
          rowCount: rows.length,
          paginationText: pagInfo ? pagInfo.textContent.trim() : '',
          headerCells,
          firstFewRows,
          neverUsedData
        };
      })()
    `
  });

  const state1 = checkInitial.result.result.value;
  console.log('Total equipment count:', state1.totalEquipment);
  console.log('Rendered audit rows:', state1.rowCount);
  console.log('Pagination text:', state1.paginationText);
  console.log('Header cells:', state1.headerCells);
  console.log('Never-used item rendered check:', state1.neverUsedData);

  // Column alignment check
  console.log('\n--- Column alignment check across header and rows ---');
  state1.firstFewRows.forEach(r => {
    console.log(`Row ${r.index}:`);
    r.cells.forEach((c, idx) => {
      const hCell = state1.headerCells[idx];
      const match = hCell && Math.abs(hCell.left - c.left) <= 1;
      console.log(`  Col ${idx} (${hCell?.text || ''}): Header Left=${hCell?.left}, Row Left=${c.left}, Match=${match}`);
    });
  });

  // TEST 3: Expand a row with history (e.g. Infusion Pump A or any item with uses > 0)
  console.log('\n--- TEST 3: Expand row with history and verify timeline ---');
  const expandRes = await send('Runtime.evaluate', {
    returnByValue: true,
    awaitPromise: true,
    expression: `
      (async () => {
        const rows = Array.from(document.querySelectorAll('.audit-eq-row'));
        const rowWithUses = rows.find(r => {
          const u = r.querySelector('.audit-eq-uses');
          return u && parseInt(u.textContent.trim(), 10) > 0;
        });

        if (!rowWithUses) return { error: 'No row with uses found' };

        const headerBtn = rowWithUses.querySelector('.audit-eq-row-header');
        headerBtn.click();
        await new Promise(r => setTimeout(r, 600));

        const isOpen = rowWithUses.classList.contains('open');
        const timeline = rowWithUses.querySelector('.audit-timeline');
        const timelineText = timeline ? timeline.textContent.trim() : '';
        const entryCount = timeline ? timeline.querySelectorAll('.timeline-entry').length : 0;

        return {
          rowId: rowWithUses.id,
          eqName: rowWithUses.querySelector('.audit-eq-name')?.textContent.trim(),
          isOpen,
          entryCount,
          timelineSnippet: timelineText.slice(0, 150)
        };
      })()
    `
  });
  console.log('Expand test result:', expandRes.result.result.value);

  // TEST 4: Empty state filter test & Clear filters button
  console.log('\n--- TEST 4: Empty state and Clear filters test ---');
  const emptyStateRes = await send('Runtime.evaluate', {
    returnByValue: true,
    awaitPromise: true,
    expression: `
      (async () => {
        const searchInput = document.getElementById('audit-search');
        searchInput.value = 'zzzznonexistentequipment12345';
        renderAuditPage();
        await new Promise(r => setTimeout(r, 300));

        const emptyEl = document.querySelector('.audit-eq-list .empty-state');
        const emptyText = emptyEl ? emptyEl.querySelector('.empty-text')?.textContent.trim() : '';
        const clearBtn = emptyEl ? emptyEl.querySelector('button') : null;
        const hasClearBtn = clearBtn !== null;

        let restoredRowCount = 0;
        if (hasClearBtn) {
          clearBtn.click();
          await new Promise(r => setTimeout(r, 300));
          restoredRowCount = document.querySelectorAll('.audit-eq-row').length;
        }

        return {
          emptyStateShown: !!emptyEl,
          emptyText,
          hasClearBtn,
          restoredRowCountAfterClear: restoredRowCount,
          searchValAfterClear: document.getElementById('audit-search').value
        };
      })()
    `
  });
  console.log('Empty state test result:', emptyStateRes.result.result.value);

  // TEST 5: Responsive Screenshots & Dark/Light modes
  console.log('\n--- TEST 5: Capture screenshots across viewports & themes ---');
  const widths = [1920, 1440, 1280, 1024];
  const themes = ['light', 'dark'];

  for (const theme of themes) {
    await send('Runtime.evaluate', {
      expression: `
        document.documentElement.setAttribute('data-theme', '${theme}');
        localStorage.setItem('theme', '${theme}');
      `
    });

    for (const w of widths) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });
      await new Promise(r => setTimeout(r, 200));

      const ss = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`docs/ui-review/bug3-after-${theme}-${w}.png`, Buffer.from(ss.result.data, 'base64'));
    }
  }

  // Standard bug3-after.png at 1280 (light)
  await send('Runtime.evaluate', {
    expression: `
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    `
  });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  const finalSs = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`docs/ui-review/bug3-after.png`, Buffer.from(finalSs.result.data, 'base64'));
  console.log('Saved docs/ui-review/bug3-after.png and responsive screenshots.');

  console.log('\n--- Console Errors during run ---');
  console.log('Error count:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach(e => console.error('Console error:', e));
  } else {
    console.log('No console errors recorded! Clean run.');
  }

  ws.close();
}

main().catch(console.error);
