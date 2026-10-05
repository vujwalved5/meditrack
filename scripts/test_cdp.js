// scripts/test_cdp.js
import fs from 'fs';

async function main() {
  const tabs = await fetch('http://localhost:9222/json/list').then(r => r.json());
  console.log('Tabs:', tabs.map(t => ({ id: t.id, url: t.url })));
  const pageTab = tabs.find(t => t.type === 'page');
  if (!pageTab) throw new Error('No page tab found');

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
  console.log('Connected to CDP WebSocket');

  await send('Page.enable');
  await send('Runtime.enable');

  // Navigate to app
  await send('Page.navigate', { url: 'http://localhost:8085/' });
  await new Promise(r => setTimeout(r, 1000));

  // Set session in localStorage and reload
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('meditrack_session', JSON.stringify({id: 1, username: 'admin', role: 'Manager'}));
      location.reload();
    `
  });
  await new Promise(r => setTimeout(r, 1500));

  // Check title and url
  const res = await send('Runtime.evaluate', {
    expression: `document.title + ' | screen: ' + (document.getElementById('app-screen').style.display !== 'none')`
  });
  console.log('Result:', res.result?.result?.value);

  // Take screenshot
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('docs/ui-review/cdp_test.png', Buffer.from(ss.result.data, 'base64'));
  console.log('Screenshot saved to docs/ui-review/cdp_test.png');

  ws.close();
}

main().catch(console.error);
