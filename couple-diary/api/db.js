const L = require('./_lib');
async function load(id, a) {
  if (!a.dataFile) return {};
  const r = await L.drv(id, a, L.D + '/' + a.dataFile + '?alt=media'); return r.ok ? r.json() : {};
}
module.exports = L.route(async (req, res) => {
  const id = L.sess(req); let a = id && await L.getAcc(id);
  if (!a) return L.send(res, 401, {});
  if (req.method === 'GET') {
    const v = +(await L.rd('GET', 'v:' + id)) || 0, since = +new URL(req.url, 'http://x').searchParams.get('since');
    if (since && since === v) return L.send(res, 200, { ver: v, same: true });
    return L.send(res, 200, { ver: v, data: await load(id, a) });
  }
  if (req.method !== 'POST') return L.send(res, 405, {});
  const ops = (await L.json(req)).ops;
  if (!Array.isArray(ops)) return L.send(res, 400, {});
  if (!(await L.lock(id))) return L.send(res, 503, { error: 'Sibuk, coba lagi.' });
  try {
    a = await L.getAcc(id); await L.ensureFolder(id, a);
    const data = await load(id, a);
    for (const o of ops) {
      if (!/^[a-z]{2,12}$/.test(o.col) || typeof o.id !== 'string') continue;
      data[o.col] = data[o.col] || {};
      if (o.doc === null) delete data[o.col][o.id]; else data[o.col][o.id] = o.doc;
    }
    const buf = Buffer.from(JSON.stringify(data));
    if (a.dataFile) {
      const r = await L.drv(id, a, L.UP + '/' + a.dataFile + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: buf });
      if (!r.ok) throw new Error('save ' + r.status);
    } else { a.dataFile = (await L.createFile(id, a, 'data.json', 'application/json', buf)).id; await L.putAcc(id, a); }
    L.send(res, 200, { ver: await L.rd('INCR', 'v:' + id) });
  } finally { await L.rd('DEL', 'l:' + id); }
});
