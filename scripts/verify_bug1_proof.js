// scripts/verify_bug1_proof.js
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

  const widths = [1920, 1440, 1280, 1024, 768, 390];
  const themes = ['light', 'dark'];
  const states = ['collapsed', 'expanded'];

  const results = [];

  for (const theme of themes) {
    // Set theme
    await send('Runtime.evaluate', {
      expression: `
        document.documentElement.setAttribute('data-theme', '${theme}');
        localStorage.setItem('theme', '${theme}');
      `
    });

    for (const state of states) {
      for (const w of widths) {
        await send('Emulation.setDeviceMetricsOverride', {
          width: w,
          height: 900,
          deviceScaleFactor: 1,
          mobile: w <= 768
        });

        // Toggle state if needed
        await send('Runtime.evaluate', {
          expression: `
            if (${state === 'collapsed'} !== tilesCollapsed) {
              toggleTilesCollapse();
            }
          `
        });
        await new Promise(r => setTimeout(r, 150));

        const evalRes = await send('Runtime.evaluate', {
          returnByValue: true,
          expression: `
            (() => {
              const docScroll = document.documentElement.scrollWidth;
              const winInner = window.innerWidth;
              const search = document.getElementById('eq-search');
              const searchRight = search ? search.getBoundingClientRect().right : 0;
              const grid = document.getElementById('product-tiles-grid');
              const gridScroll = grid ? grid.scrollWidth : 0;
              const gridClient = grid ? grid.clientWidth : 0;
              const gridRight = grid ? grid.getBoundingClientRect().right : 0;

              // Check if any tile name is clipped
              const names = Array.from(document.querySelectorAll('.product-tiles-grid .pt-name'));
              const labels = names.map(n => ({
                text: n.textContent,
                scrollWidth: n.scrollWidth,
                clientWidth: n.clientWidth,
                clientHeight: n.clientHeight,
                scrollHeight: n.scrollHeight
              }));

              return {
                theme: '${theme}',
                state: '${state}',
                width: ${w},
                docScrollWidth: docScroll,
                winInnerWidth: winInner,
                noHorizontalOverflow: docScroll <= winInner,
                searchRight: Math.round(searchRight),
                searchVisible: searchRight <= winInner - 8,
                gridScrollWidth: gridScroll,
                gridClientWidth: gridClient,
                gridRight: Math.round(gridRight),
                gridWithinWindow: gridRight <= winInner,
                internalScrollWhenCollapsed: '${state}' === 'collapsed' ? (gridScroll > gridClient) : true
              };
            })()
          `
        });

        const val = evalRes.result.result.value;
        results.push(val);

        // Capture screenshot
        const ss = await send('Page.captureScreenshot', { format: 'png' });
        const filename = `docs/ui-review/bug1-after-${theme}-${state}-${w}.png`;
        fs.writeFileSync(filename, Buffer.from(ss.result.data, 'base64'));
      }
    }
  }

  // Also save bug1-after.png
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  const finalSs = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`docs/ui-review/bug1-after.png`, Buffer.from(finalSs.result.data, 'base64'));

  console.table(results);
  ws.close();
}

main().catch(console.error);
