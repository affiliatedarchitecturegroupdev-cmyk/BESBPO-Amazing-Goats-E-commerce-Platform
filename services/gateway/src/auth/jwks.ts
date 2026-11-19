import { createPublicKey, type KeyObject } from 'node:crypto';

/**
 * Turning an IdP's JWKS into keys `verifyJwt` can use (T-058).
 *
 * A realm rotates its signing keys, so the set is fetched rather than pinned,
 * and a token's `kid` picks the key. Cached briefly: a JWKS fetch on every
 * request would put the IdP on the critical path of every sign-in.
 */

export interface Jwk {
  kid?: string;
  kty?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
  [key: string]: unknown;
}

export interface JwksCache {
  keys: Jwk[];
  fetchedAt: number;
}

/** How long a fetched set is trusted before it is fetched again. */
export const JWKS_TTL_MS = 10 * 60_000;

/**
 * The `kid` of a token, without verifying it. Only used to choose which key to
 * verify *with* — the signature check that follows is what makes it safe.
 */
export function keyIdOf(token: string): string | undefined {
  const parts = token.split('.');
  if (parts.length !== 3) return undefined;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    return typeof header?.kid === 'string' ? header.kid : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The key matching `kid`, or — when the set has exactly one key — that key,
 * since some IdPs omit `kid`. Returns `undefined` rather than guessing among
 * several, because guessing is how you verify against the wrong key.
 */
export function selectKey(keys: Jwk[], kid: string | undefined): Jwk | undefined {
  if (kid) return keys.find((k) => k.kid === kid);
  return keys.length === 1 ? keys[0] : undefined;
}

/**
 * Converts a JWK to a Node key object. `createPublicKey` understands JWK
 * directly, so there is no hand-rolled RSA assembly here — that is where
 * these helpers usually go wrong.
 */
export function jwkToPublicKey(jwk: Jwk): KeyObject | undefined {
  try {
    return createPublicKey({ key: jwk as any, format: 'jwk' });
  } catch {
    return undefined;
  }
}

/** The PEM form `verifyJwt` takes. */
export function jwkToPem(jwk: Jwk): string | undefined {
  const key = jwkToPublicKey(jwk);
  if (!key) return undefined;
  try {
    return key.export({ type: 'spki', format: 'pem' }) as string;
  } catch {
    return undefined;
  }
}

export function cacheFresh(cache: JwksCache | undefined, now: number, ttl = JWKS_TTL_MS): boolean {
  return Boolean(cache) && now - cache!.fetchedAt < ttl;
}
