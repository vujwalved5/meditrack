// scripts/check_styles.js
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
      const wrap = document.getElementById('equipment-table-wrap');
      const th = document.getElementById('eq-th-row');
      const firstRow = document.querySelector('.eq-table-row');
      const sWrap = window.getComputedStyle(wrap);
      const sTh = window.getComputedStyle(th);
      const sFirst = firstRow ? window.getComputedStyle(firstRow) : {};
      return {
        wrap: { padding: sWrap.padding, margin: sWrap.margin, overflow: sWrap.overflow, top: wrap.getBoundingClientRect().top },
        th: { padding: sTh.padding, margin: sTh.margin, position: sTh.position, top: sTh.top, rectTop: th.getBoundingClientRect().top, offsetTop: th.offsetTop },
        firstRow: { rectTop: firstRow.getBoundingClientRect().top, offsetTop: firstRow.offsetTop, position: sFirst.position, margin: sFirst.margin }
      };
    })()`
  });
  console.log(res.result.result.value);
  ws.close();
}
main().catch(console.error);
