const L = require('../_lib');
module.exports = L.route(async (req, res) => {
  const st = L.crypto.randomBytes(16).toString('hex');
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: `https://${L.host(req)}/api/auth/callback`, response_type: 'code',
    scope: 'openid email profile https://www.googleapis.com/auth/drive.file', access_type: 'offline', prompt: 'consent', state: st
  });
  res.setHeader('Set-Cookie', L.ck('cs', st + '.' + L.sign(st), '/api/auth', 600));
  res.statusCode = 302; res.setHeader('Location', 'https://accounts.google.com/o/oauth2/v2/auth?' + p); res.end();
});
