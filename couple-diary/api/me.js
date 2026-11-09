const L = require('./_lib');
module.exports = L.route(async (req, res) => {
  const id = L.sess(req), a = id && await L.getAcc(id);
  if (!a) return L.send(res, 401, {});
  L.send(res, 200, { email: a.email, username: a.username || null });
});
