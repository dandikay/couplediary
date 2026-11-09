const L = require('../_lib');
module.exports = L.route(async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, {});
  const b = await L.json(req), u = String(b.username || '').trim().toLowerCase(), p = String(b.password || '');
  if (await L.limit('l:' + L.ip(req) + ':' + u, 8)) return L.send(res, 429, { error: 'Terlalu banyak percobaan. Coba lagi 10 menit lagi.' });
  const id = u && await L.rd('GET', 'u:' + u), a = id && await L.getAcc(id);
  const ok = L.verPw(p, a && a.ph ? a.ph : L.DUMMY) && !!(a && a.ph);
  if (!ok) return L.send(res, 401, { error: 'Username atau password salah.' });
  await L.rd('DEL', 'rl:l:' + L.ip(req) + ':' + u);
  res.setHeader('Set-Cookie', L.sessCookie(id)); L.send(res, 200, { ok: true });
});
