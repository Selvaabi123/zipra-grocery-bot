/* Stateless signed link so the ZIPRA shop knows which WhatsApp chat to push
   "Pay Now" to — without ever asking the customer for their phone number.

   The bot embeds f=<token> in the Shop CTA URL. The token is a signed waId:
   token = base64url(waId) + "." + HMAC(base64url(waId)). It verifies without
   server state and stops working if tampered with.
*/
const crypto = require("crypto");

const SECRET =
  process.env.SHOPLINK_SECRET ||
  process.env.DELIVERY_OTP_SECRET ||
  process.env.PAYMENT_WEBHOOK_SECRET ||
  "zipra-shoplink-dev-secret";

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function sign(waId) {
  const payload = b64url(String(waId || ""));
  if (!payload) return "";
  const mac = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

function verify(token) {
  if (!token || token.length > 256) return null;
  const m = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(token).trim());
  if (!m) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(m[1]).digest("base64url");
  const given = Buffer.from(m[2]);
  const exp = Buffer.from(expected);
  if (given.length !== exp.length || !crypto.timingSafeEqual(given, exp)) return null;
  const waId = Buffer.from(m[1], "base64url").toString("utf8");
  return /^\d{10,13}$/.test(waId) ? waId : null;
}

function shopUrl(waId, base) {
  const root = String(base || "").replace(/\/+$/, "");
  const tok = sign(waId);
  return `${root}/shop${tok ? "?f=" + tok : ""}`;
}

module.exports = { sign, verify, shopUrl };