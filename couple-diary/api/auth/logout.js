const L = require('../_lib');
module.exports = L.route(async (req, res) => { res.setHeader('Set-Cookie', L.clearCookie()); L.send(res, 200, { ok: true }); });
