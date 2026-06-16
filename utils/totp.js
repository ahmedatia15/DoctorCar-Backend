// PATH: backend/utils/totp.js
// Self-contained TOTP (RFC 6238) using Node's built-in crypto — no external
// dependency required. Compatible with Google Authenticator / Authy etc.
import crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// ---- Base32 (RFC 4648) ----
const base32Encode = (buffer) => {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
};

const base32Decode = (input) => {
  const clean = String(input || "")
    .toUpperCase()
    .replace(/=+$/, "")
    .replace(/\s+/g, "");

  let bits = 0;
  let value = 0;
  const bytes = [];

  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

// Generate a new base32 secret (default 20 bytes => 160 bits).
export const generateSecret = (bytes = 20) =>
  base32Encode(crypto.randomBytes(bytes));

// Compute a TOTP code for a given step.
const hotp = (secretBuffer, counter, digits = 6) => {
  const buf = Buffer.alloc(8);
  // counter is < 2^53 in practice; write as big-endian 64-bit.
  buf.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", secretBuffer).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (code % 10 ** digits).toString().padStart(digits, "0");
};

// Verify a token within a small time window (default ±1 step = ±30s).
export const verifyToken = (secret, token, { window = 1, step = 30 } = {}) => {
  const cleanToken = String(token || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleanToken)) return false;

  const secretBuffer = base32Decode(secret);
  if (!secretBuffer.length) return false;

  const counter = Math.floor(Date.now() / 1000 / step);
  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    if (hotp(secretBuffer, counter + errorWindow) === cleanToken) return true;
  }
  return false;
};

// Build the otpauth:// URL the authenticator app scans.
export const otpauthURL = ({ secret, label, issuer = "Doctor Car" }) => {
  const enc = encodeURIComponent;
  return (
    `otpauth://totp/${enc(issuer)}:${enc(label)}` +
    `?secret=${secret}&issuer=${enc(issuer)}&algorithm=SHA1&digits=6&period=30`
  );
};
