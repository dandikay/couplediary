const L = require('./_lib');
module.exports = L.route(async (req, res) => {
  const id = L.sess(req), a = id && await L.getAcc(id);
  if (!a) return L.send(res, 401, {});
  if (req.method !== 'POST') return L.send(res, 405, {});
  const b = await L.json(req), u = String(b.username || '').trim().toLowerCase(), np = String(b.password || ''), cur = String(b.current || '');
  if (!/^[a-z0-9._-]{3,24}$/.test(u)) return L.send(res, 400, { error: 'Username 3–24 karakter: huruf kecil, angka, titik, strip.' });
  if (np && np.length < 6) return L.send(res, 400, { error: 'Password minimal 6 karakter.' });
  if (a.ph) {
    if (await L.limit('a:' + id, 8)) return L.send(res, 429, { error: 'Terlalu banyak percobaan. Coba lagi 10 menit lagi.' });
    if (!L.verPw(cur, a.ph)) return L.send(res, 403, { error: 'Password sekarang salah.' });
  } else if (!np) return L.send(res, 400, { error: 'Password minimal 6 karakter.' });
  if (u !== a.username) {
    const ok = await L.rd('SET', 'u:' + u, id, 'NX');
    if (ok !== 'OK' && (await L.rd('GET', 'u:' + u)) !== id) return L.send(res, 409, { error: 'Username sudah dipakai.' });
    if (a.username) await L.rd('DEL', 'u:' + a.username);
    a.username = u;
  }
  if (np) a.ph = L.hashPw(np);
  await L.putAcc(id, a); L.send(res, 200, { ok: true, username: u });
});
