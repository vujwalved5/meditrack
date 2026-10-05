// scripts/verify_bug2_proof.js
import fs from 'fs';

async function main() {
  const tabs = await fetch('http://localhost:9222/json/list').then(r => r.json());
  const pageTab = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  let id = 1;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
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
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 1500));

  const widths = [1920, 1440, 1280, 1024];

  for (const w of widths) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 300));

    const checkRes = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          const header = document.getElementById('eq-th-row');
          const thButtons = Array.from(header.querySelectorAll('.th-btn, span'));
          
          // Header cells
          const thEquipment = document.getElementById('th-name').getBoundingClientRect();
          const thDept = document.getElementById('th-department').getBoundingClientRect();
          const thStatus = document.getElementById('th-status').getBoundingClientRect();
          const thHolder = Array.from(header.children).find(c => c.textContent.toUpperCase().includes('HOLDER'))?.getBoundingClientRect() || {};
          const thHeldFor = document.getElementById('th-held_for').getBoundingClientRect();
          const thActions = Array.from(header.children).find(c => c.textContent.toUpperCase().includes('ACTION'))?.getBoundingClientRect() || {};

          const rows = Array.from(document.querySelectorAll('.eq-table-row')).slice(0, 8);
          const rowData = rows.map((r, idx) => {
            const line = r.querySelector('.eq-row-line');
            const rect = line ? line.getBoundingClientRect() : r.getBoundingClientRect();
            const cells = line ? Array.from(line.querySelectorAll('[role="cell"]')) : [];

            const cChevron = cells[0] ? cells[0].getBoundingClientRect() : null;
            const cName = cells[1] ? cells[1].getBoundingClientRect() : null;
            const cDept = cells[2] ? cells[2].getBoundingClientRect() : null;
            const cStatus = cells[3] ? cells[3].getBoundingClientRect() : null;
            const cHolder = cells[4] ? cells[4].getBoundingClientRect() : null;
            const cHeldFor = cells[5] ? cells[5].getBoundingClientRect() : null;
            const cActions = cells[6] ? cells[6].getBoundingClientRect() : null;

            const nameEl = r.querySelector('.eq-name-text');
            const holderEl = r.querySelector('.eq-cell-holder-location');
            const heldForEl = r.querySelector('.eq-cell-held-for');
            const isAvail = r.querySelector('.badge-status-available') !== null;

            return {
              rowIndex: idx + 1,
              id: r.id,
              rowHeight: Math.round(rect.height),
              heightOk: rect.height <= 64,
              deptLeft: cDept ? Math.round(cDept.left) : 0,
              statusLeft: cStatus ? Math.round(cStatus.left) : 0,
              holderLeft: cHolder ? Math.round(cHolder.left) : 0,
              heldForLeft: cHeldFor ? Math.round(cHeldFor.left) : 0,
              actionsLeft: cActions ? Math.round(cActions.left) : 0,
              isAvail,
              holderText: holderEl ? holderEl.textContent.trim() : '',
              availHolderIsDash: isAvail ? (holderEl && holderEl.textContent.trim() === '—') : true,
              heldForText: heldForEl ? heldForEl.textContent.trim() : ''
            };
          });

          // Check sticky header and first row
          const headerRect = header.getBoundingClientRect();
          const firstRowLine = rows[0] ? (rows[0].querySelector('.eq-row-line') || rows[0]) : null;
          const firstRowRect = firstRowLine ? firstRowLine.getBoundingClientRect() : null;
          const noHeaderOverlap = firstRowRect ? (firstRowRect.top >= headerRect.bottom - 1) : false;

          // Check count badge
          const countBadge = document.getElementById('eq-count');
          const countVal = countBadge ? parseInt(countBadge.textContent.trim(), 10) : 0;

          return {
            width: ${w},
            headerLefts: {
              dept: Math.round(thDept.left),
              status: Math.round(thStatus.left),
              holder: Math.round(thHolder.left),
              heldFor: Math.round(thHeldFor.left),
              actions: Math.round(thActions.left)
            },
            headerBottom: Math.round(headerRect.bottom),
            firstRowTop: firstRowRect ? Math.round(firstRowRect.top) : 0,
            noHeaderOverlap,
            countBadgeVal: countVal,
            rows: rowData
          };
        })()
      `
    });

    console.log(`\n================ Viewport Width: ${w}px ================`);
    if (checkRes.result.exceptionDetails) {
      console.error('Browser error:', checkRes.result.exceptionDetails);
      continue;
    }
    const val = checkRes.result.result.value;
    console.log('Header Column Lefts:', val.headerLefts);
    console.log('Header Bottom:', val.headerBottom, 'First Row Top:', val.firstRowTop, 'No Overlap:', val.noHeaderOverlap);
    console.log('Count Badge Value:', val.countBadgeVal);
    console.table(val.rows.map(r => ({
      Row: r.rowIndex,
      Height: r.rowHeight,
      HeightOk: r.heightOk,
      DeptLeft: r.deptLeft,
      StatusLeft: r.statusLeft,
      HolderLeft: r.holderLeft,
      HeldForLeft: r.heldForLeft,
      ActionsLeft: r.actionsLeft,
      AvailHolderOk: r.availHolderIsDash,
      Holder: r.holderText,
      HeldFor: r.heldForText
    })));

    // Capture screenshot
    const ss = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`docs/ui-review/bug2-after-${w}.png`, Buffer.from(ss.result.data, 'base64'));
  }

  // Also save bug2-after.png
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  const finalSs = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`docs/ui-review/bug2-after.png`, Buffer.from(finalSs.result.data, 'base64'));

  ws.close();
}

main().catch(console.error);
