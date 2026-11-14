import { createHmac, randomBytes } from 'node:crypto';

/**
 * TOTP (RFC 6238) over HMAC-SHA1, the scheme authenticator apps use. Pure
 * functions, so the RFC test vector can be checked directly.
 */

export const TOTP_PERIOD_SEC = 30;
export const TOTP_DIGITS = 6;

/** The 20-byte secret, base32 encoded, as an authenticator app expects. */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

/** The counter value for a moment in time: floor(unixSeconds / period). */
export function counterFor(unixSeconds: number, period = TOTP_PERIOD_SEC): number {
  return Math.floor(unixSeconds / period);
}

/** The HOTP value for a counter: RFC 4226 dynamic truncation of the HMAC. */
export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

/** The TOTP value for a moment in time. */
export function totp(secret: string, unixSeconds: number, period = TOTP_PERIOD_SEC): string {
  return hotp(base32Decode(secret), counterFor(unixSeconds, period));
}

/**
 * Whether `code` is valid for `unixSeconds`, allowing one step either side for
 * clock drift. Compared in constant time so a wrong code leaks no timing.
 */
export function verifyTotp(
  secret: string,
  code: string,
  unixSeconds: number,
  opts: { period?: number; window?: number } = {},
): boolean {
  const period = opts.period ?? TOTP_PERIOD_SEC;
  const window = opts.window ?? 1;
  if (!/^\d{6}$/.test(code)) return false;
  for (let step = -window; step <= window; step += 1) {
    const candidate = totp(secret, unixSeconds + step * period, period);
    if (timingSafeEqualStr(candidate, code)) return true;
  }
  return false;
}

/** otpauth URI an authenticator app scans to enrol. */
export function otpauthUri(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: String(TOTP_DIGITS), period: String(TOTP_PERIOD_SEC) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Base32 (RFC 4648, no padding), the encoding authenticator apps use. */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error(`invalid base32 character: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
