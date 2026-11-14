import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Constant-time comparison of two hex strings. Length is compared first because
 * `timingSafeEqual` throws on a length mismatch, and the length itself is not a
 * secret.
 */
export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** HMAC-SHA256 of the raw body, hex encoded. */
export function hmacSha256Hex(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export interface SignatureCheck {
  secret: string;
  rawBody: string;
  /** The signature exactly as the provider sent it. */
  signature: string | undefined;
  /** Optional timestamp, in seconds, from a `t=...` header. */
  timestampSec?: number;
  /** How long a signature stays valid. Default 300 seconds (5 minutes). */
  toleranceSec?: number;
  now?: Date;
}

/**
 * Verifies a header of the form `t=<unix>,v1=<hex>`, where `v1` is
 * `HMAC-SHA256(secret, "<t>.<rawBody>")`. Returns false for a missing or
 * malformed header, a signature that does not match, or a timestamp outside the
 * tolerance window (which rejects a replayed body).
 */
export function verifyHmacSignature(check: SignatureCheck): boolean {
  const { secret, rawBody, signature } = check;
  if (!signature) return false;

  const parts = new Map<string, string>();
  for (const piece of signature.split(',')) {
    const [key, value] = piece.split('=');
    if (key && value) parts.set(key.trim(), value.trim());
  }
  const t = parts.get('t');
  const v1 = parts.get('v1');
  if (!t || !v1) return false;

  const timestamp = Number(t);
  if (!Number.isFinite(timestamp)) return false;

  const tolerance = check.toleranceSec ?? 300;
  const nowSec = Math.floor((check.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSec - timestamp) > tolerance) return false;

  const expected = hmacSha256Hex(secret, `${t}.${rawBody}`);
  return safeEqualHex(expected, v1);
}

/**
 * Verifies a signature that is `HMAC-SHA256(secret, rawBody)` with no timestamp
 * envelope, used by providers that sign the body directly. There is no replay
 * window here; the caller deduplicates by event id instead (see
 * `payments.provider_events`).
 */
export function verifyHmacBody(
  secret: string,
  rawBody: string,
  signature: string | undefined,
): boolean {
  if (!signature) return false;
  return safeEqualHex(hmacSha256Hex(secret, rawBody), signature);
}
