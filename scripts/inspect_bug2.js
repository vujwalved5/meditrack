// scripts/inspect_bug2.js
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

  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 1500));

  const info = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `
      (() => {
        const appHeader = document.querySelector('.header');
        const appHeaderRect = appHeader ? appHeader.getBoundingClientRect() : null;
        const tableWrap = document.getElementById('equipment-table-wrap');
        const tableWrapRect = tableWrap ? tableWrap.getBoundingClientRect() : null;
        const thRow = document.getElementById('eq-th-row');
        const thRowRect = thRow ? thRow.getBoundingClientRect() : null;
        const firstRow = document.querySelector('.eq-table-row');
        const firstRowRect = firstRow ? firstRow.getBoundingClientRect() : null;

        // Check if there are elements before eq-th-row inside equipment-table-wrap
        const wrapChildren = Array.from(tableWrap.children).map(c => ({
          tag: c.tagName,
          id: c.id,
          class: c.className,
          rect: c.getBoundingClientRect(),
          offsetHeight: c.offsetHeight
        }));

        // Check holder location text for available items
        const rows = Array.from(document.querySelectorAll('.eq-table-row')).slice(0, 5).map(r => ({
          id: r.id,
          text: r.innerText.replace(/\\n+/g, ' | '),
          rect: r.getBoundingClientRect()
        }));

        const countBadge = document.getElementById('eq-count');

        return {
          appHeaderHeight: appHeaderRect ? appHeaderRect.height : 0,
          thRowTop: thRowRect ? thRowRect.top : 0,
          tableWrapTop: tableWrapRect ? tableWrapRect.top : 0,
          wrapChildren,
          firstRowTop: firstRowRect ? firstRowRect.top : 0,
          countBadgeText: countBadge ? countBadge.textContent : null,
          rows
        };
      })()
    `
  });

  console.log(JSON.stringify(info.result.result.value, null, 2));
  ws.close();
}

main().catch(console.error);
