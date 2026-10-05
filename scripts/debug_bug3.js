// scripts/debug_bug3.js
import fs from 'fs';

async function main() {
  const tabs = await fetch('http://localhost:9222/json/list').then(r => r.json());
  const pageTab = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  let id = 1;
  const callbacks = new Map();

  const consoleLogs = [];
  const exceptions = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      consoleLogs.push({ type: msg.params.type, args: msg.params.args.map(a => a.value || a.description) });
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      exceptions.push(msg.params.exceptionDetails);
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

  // Hard reload directly on Audit Log page (#auditlog)
  console.log('Navigating directly to Audit Log page...');
  await send('Page.navigate', { url: 'http://localhost:8085/#auditlog' });
  await new Promise(r => setTimeout(r, 2000));

  // Also trigger navigation click if hash didn't switch automatically
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        if (typeof navigateTo === 'function') navigateTo('auditlog');
        else if (typeof showPage === 'function') showPage('auditlog');
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1500));

  // Capture before screenshot
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('docs/ui-review/bug3-before.png', Buffer.from(ss.result.data, 'base64'));
  console.log('Saved docs/ui-review/bug3-before.png');

  // Step 1: Exceptions recorded
  console.log('\n--- STEP 1: DevTools Exceptions recorded ---');
  console.log('Exceptions count:', exceptions.length);
  exceptions.forEach((e, idx) => {
    console.log(`[Exception ${idx + 1}]`, e.text, e.exception ? e.exception.description : '');
  });

  // Step 2: Log state in console
  console.log('\n--- STEP 2: Console state evaluation ---');
  const evalRes = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `
      (() => {
        return {
          allEquipmentLength: typeof allEquipment !== 'undefined' ? allEquipment.length : 'undefined',
          allAuditLogsKeysLength: typeof allAuditLogs !== 'undefined' ? Object.keys(allAuditLogs).length : 'undefined',
          currentPage: typeof auditPage !== 'undefined' ? auditPage : 'undefined',
          pageSize: typeof auditPageSize !== 'undefined' ? auditPageSize : 'undefined',
          searchFilter: (document.getElementById('audit-search') || {}).value || '',
          deptFilter: (document.getElementById('audit-dept-filter') || {}).value || '',
          dateFilter: (document.getElementById('audit-date-filter') || {}).value || '',
          actionFilter: (document.getElementById('audit-action-filter') || {}).value || '',
          hideNeverUsed: typeof auditHideNeverUsed !== 'undefined' ? auditHideNeverUsed : 'undefined',
          renderedRowElements: document.querySelectorAll('.audit-eq-row').length,
          renderedHeader: document.querySelectorAll('.audit-table-header').length,
          containerHTML: (document.getElementById('audit-eq-list') || {}).innerHTML || '',
          localStorageAuditPage: localStorage.getItem('auditPage'),
          localStorageAuditPageSize: localStorage.getItem('auditPageSize'),
          localStorageAuditFilters: localStorage.getItem('auditFilters')
        };
      })()
    `
  });

  console.log('Evaluated State:', JSON.stringify(evalRes.result.result.value, null, 2));

  // Let's test calling renderAuditPage() directly to capture the exact exception if any
  const callRender = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `
      (() => {
        try {
          renderAuditPage();
          return { success: true };
        } catch (err) {
          return { success: false, error: err.toString(), stack: err.stack };
        }
      })()
    `
  });

  console.log('\n--- Direct renderAuditPage() call result ---');
  console.log(callRender.result.result.value);

  ws.close();
}

main().catch(console.error);
