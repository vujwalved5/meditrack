// scripts/inspect_eq_list.js
async function main() {
  const tabs = await fetch('http://localhost:9222/json/list').then(r => r.json());
  const page = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const send = (m, p = {}) => new Promise(r => {
    const i = id++;
    const onm = e => { const d = JSON.parse(e.data); if (d.id === i) { ws.removeEventListener('message', onm); r(d); } };
    ws.addEventListener('message', onm);
    ws.send(JSON.stringify({ id: i, method: m, params: p }));
  });
  await new Promise(r => ws.onopen = r);
  const res = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const list = document.getElementById('equipment-list');
      const children = Array.from(list.children).map(c => ({
        tag: c.tagName,
        id: c.id,
        className: c.className,
        offsetHeight: c.offsetHeight
      }));
      return { childCount: children.length, firstFew: children.slice(0, 10) };
    })()`
  });
  console.log(res.result.result.value);
  ws.close();
}
main().catch(console.error);
