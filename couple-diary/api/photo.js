const L = require('./_lib');
module.exports = L.route(async (req, res) => {
  const id = L.sess(req), a = id && await L.getAcc(id);
  if (!a) return L.send(res, 401, {});
  const q = new URL(req.url, 'http://x').searchParams, k = q.get('k') || '', v = q.get('v') === 'h' ? 'h' : 't';
  if (!/^\d+_\d+$/.test(k) || !a.folder) return L.send(res, 400, {});
  const name = v + '_' + k + '.jpg', ck = 'f:' + id + ':' + name;
  let fid = await L.rd('GET', ck);
  if (!fid) {
    const r = await L.drv(id, a, L.D + '?fields=files(id)&q=' + encodeURIComponent(`name='${name}' and '${a.folder}' in parents and trashed=false`)).then(r => r.json());
    fid = r.files && r.files[0] && r.files[0].id; if (fid) await L.rd('SET', ck, fid);
  }
  if (req.method === 'GET') {
    if (!fid) return L.send(res, 404, {});
    const r = await L.drv(id, a, L.D + '/' + fid + '?alt=media'); if (!r.ok) return L.send(res, 404, {});
    res.setHeader('Content-Type', 'image/jpeg'); res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    return res.end(Buffer.from(await r.arrayBuffer()));
  }
  if (req.method !== 'POST') return L.send(res, 405, {});
  if (fid) return L.send(res, 200, { exists: true });
  const buf = await L.body(req); if (!buf.length || buf.length > 4e6) return L.send(res, 413, {});
  const f = await L.createFile(id, a, name, 'image/jpeg', buf); await L.rd('SET', ck, f.id); L.send(res, 200, { ok: true });
});
