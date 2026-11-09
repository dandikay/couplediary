const L = require('../_lib');
module.exports = L.route(async (req, res) => {
  const q = new URL(req.url, 'http://x').searchParams, back = (p) => { res.statusCode = 302; res.setHeader('Location', p); res.end(); };
  const c = (L.cookie(req, 'cs') || '').split('.');
  if (q.get('error') || !q.get('code') || c.length !== 2 || c[0] !== q.get('state') || L.sign(c[0]) !== c[1]) return back('/?err=login');
  const t = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: q.get('code'), client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: `https://${L.host(req)}/api/auth/callback`, grant_type: 'authorization_code' })
  }).then(r => r.json());
  if (!t.id_token) return back('/?err=login');
  if (!String(t.scope || '').includes('drive.file')) return back('/?err=drive');
  const u = JSON.parse(Buffer.from(t.id_token.split('.')[1], 'base64url').toString());
  let a = await L.getAcc(u.sub);
  if (!a) { if (!t.refresh_token) return back('/?err=login'); a = { sub: u.sub, email: u.email, rt: L.enc(t.refresh_token) }; }
  else { a.email = u.email; if (t.refresh_token) a.rt = L.enc(t.refresh_token); }
  await L.putAcc(u.sub, a);
  await L.rd('SET', 'at:' + u.sub, t.access_token, 'EX', Math.max(60, (t.expires_in || 3600) - 300));
  await L.ensureFolder(u.sub, a);
  res.setHeader('Set-Cookie', [L.sessCookie(u.sub), L.ck('cs', '', '/api/auth', 0)]);
  back('/');
});
