const crypto = require('crypto');
const RU = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const RT = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SEC = process.env.SESSION_SECRET || '';
const KEY = crypto.createHash('sha256').update('enc:' + SEC).digest();
const D = 'https://www.googleapis.com/drive/v3/files';
const UP = 'https://www.googleapis.com/upload/drive/v3/files';

const rd = (...a) => fetch(RU, { method: 'POST', headers: { Authorization: 'Bearer ' + RT }, body: JSON.stringify(a) })
  .then(r => r.json()).then(j => { if (j.error) throw new Error(j.error); return j.result; });
const enc = t => { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', KEY, iv), b = Buffer.concat([c.update(t, 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), b]).toString('base64'); };
const dec = s => { const b = Buffer.from(s, 'base64'), d = crypto.createDecipheriv('aes-256-gcm', KEY, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); };
const sign = v => crypto.createHmac('sha256', SEC).update(v).digest('base64url');
const ck = (n, v, path, age) => `${n}=${v}; Path=${path}; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const sessCookie = acc => { const v = acc + '.' + (Date.now() + 30 * 864e5); return ck('cd', v + '.' + sign(v), '/', 30 * 86400); };
const clearCookie = () => ck('cd', '', '/', 0);
const cookie = (req, n) => { const m = new RegExp('(?:^|; )' + n + '=([^;]+)').exec(req.headers.cookie || ''); return m && m[1]; };
const sess = req => {
  const c = cookie(req, 'cd'); if (!c) return null; const p = c.split('.'); if (p.length !== 3) return null;
  const v = p[0] + '.' + p[1], a = Buffer.from(sign(v)), b = Buffer.from(p[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b) || +p[1] < Date.now()) return null; return p[0];
};
const hashPw = p => { const s = crypto.randomBytes(16); return s.toString('base64') + ':' + crypto.scryptSync(p, s, 32).toString('base64'); };
const verPw = (p, h) => { const [s, k] = String(h).split(':'); const x = crypto.scryptSync(p, Buffer.from(s || '', 'base64'), 32), y = Buffer.from(k || '', 'base64'); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const DUMMY = hashPw('dummy-password');

const body = req => new Promise((ok, no) => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); req.on('error', no); });
const json = async req => { try { return JSON.parse((await body(req)).toString() || '{}'); } catch { return {}; } };
const send = (res, code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
const host = req => req.headers['x-forwarded-host'] || req.headers.host;
const ip = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
const limit = async (k, max) => { const n = await rd('INCR', 'rl:' + k); if (n === 1) await rd('EXPIRE', 'rl:' + k, 600); return n > max; };

const getAcc = async id => { const j = await rd('GET', 'a:' + id); return j ? JSON.parse(j) : null; };
const putAcc = (id, a) => rd('SET', 'a:' + id, JSON.stringify(a));

async function token(id, a) {
  const c = await rd('GET', 'at:' + id); if (c) return c;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: dec(a.rt), grant_type: 'refresh_token' })
  }).then(r => r.json());
  if (!r.access_token) throw new Error('token ' + (r.error || ''));
  await rd('SET', 'at:' + id, r.access_token, 'EX', Math.max(60, (r.expires_in || 3600) - 300));
  return r.access_token;
}
async function drv(id, a, url, opt = {}) {
  const t = await token(id, a);
  return fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + t, ...(opt.headers || {}) } });
}
async function ensureFolder(id, a) {
  if (a.folder) return a.folder;
  const r = await drv(id, a, D, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Couple Diary', mimeType: 'application/vnd.google-apps.folder' }) }).then(r => r.json());
  if (!r.id) throw new Error('folder'); a.folder = r.id; await putAcc(id, a); return r.id;
}
async function createFile(id, a, name, mime, buf) {
  const bd = 'b' + crypto.randomBytes(8).toString('hex');
  const b = Buffer.concat([Buffer.from(`--${bd}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ name, parents: [a.folder] })}\r\n--${bd}\r\nContent-Type: ${mime}\r\n\r\n`), buf, Buffer.from(`\r\n--${bd}--`)]);
  const j = await drv(id, a, UP + '?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + bd }, body: b }).then(r => r.json());
  if (!j.id) throw new Error('create'); return j;
}
const lock = async id => { for (let i = 0; i < 8; i++) { if (await rd('SET', 'l:' + id, '1', 'NX', 'EX', 15) === 'OK') return true; await new Promise(r => setTimeout(r, 400)); } return false; };

const route = fn => async (req, res) => {
  try {
    if (!SEC || SEC.length < 16 || !RU) return send(res, 500, { error: 'Server belum dikonfigurasi (SESSION_SECRET / Redis).' });
    if (req.method === 'POST') { const o = req.headers.origin; if (o && new URL(o).host !== host(req)) return send(res, 403, { error: 'Forbidden' }); }
    await fn(req, res);
  } catch (e) { console.error(e); send(res, 500, { error: 'Terjadi kesalahan server.' }); }
};
module.exports = { crypto, rd, enc, dec, sign, ck, sessCookie, clearCookie, cookie, sess, hashPw, verPw, DUMMY, body, json, send, host, ip, limit, getAcc, putAcc, token, drv, ensureFolder, createFile, lock, route, D, UP };
