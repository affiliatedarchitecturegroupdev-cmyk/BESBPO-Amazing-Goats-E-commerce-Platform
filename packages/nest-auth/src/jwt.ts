import { createHmac, timingSafeEqual, verify as verifySignature } from 'node:crypto';

export type JwtAlgorithm = 'HS256' | 'RS256';

/** Thrown for any token that fails verification. The guard maps this to a 401. */
export class JwtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtError';
  }
}

export interface JwtClaims {
  sub: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  org_id?: string;
  /** Flat role claim. */
  roles?: unknown;
  /** Keycloak style nested roles. */
  realm_access?: { roles?: unknown };
  [key: string]: unknown;
}

export interface JwtVerifyOptions {
  secret?: string;
  publicKey?: string;
  algorithms?: JwtAlgorithm[];
  issuer?: string;
  audience?: string;
  clockToleranceSec?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

export interface JwtSignOptions {
  /** HMAC secret (HS256). The gateway issues HS256 sessions. */
  secret: string;
  /** Injected so a caller can pin `iat`/`exp` in tests. */
  now?: () => number;
}

/**
 * Sign claims as a compact JWS. The counterpart to `verifyJwt`, and
 * deliberately HS256 only: the gateway mints short sessions with a secret it
 * holds, and RS256 signing would mean holding a private key in every replica.
 *
 * `iat` is stamped from `now` and `exp` is required from the caller, so a token
 * can never be issued without a lifetime.
 */
export function signJwt(
  claims: Omit<JwtClaims, 'iat'> & { exp: number },
  opts: JwtSignOptions,
): string {
  if (!opts.secret) throw new JwtError('missing signing secret');
  if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) {
    throw new JwtError('exp is required');
  }
  const iat = Math.floor((opts.now?.() ?? Date.now()) / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ ...claims, iat })).toString('base64url');
  const input = `${header}.${payload}`;
  const signature = createHmac('sha256', opts.secret).update(input).digest('base64url');
  return `${input}.${signature}`;
}

function decodeSegment(segment: string): Buffer {
  const buf = Buffer.from(segment, 'base64url');
  if (buf.length === 0) throw new JwtError('malformed token');
  return buf;
}

function decodeJson<T>(segment: string): T {
  try {
    return JSON.parse(decodeSegment(segment).toString('utf8')) as T;
  } catch {
    throw new JwtError('malformed token');
  }
}

/** Verify a compact JWS and return its claims. Throws JwtError on any failure. */
export function verifyJwt(token: string, opts: JwtVerifyOptions): JwtClaims {
  if (typeof token !== 'string') throw new JwtError('malformed token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtError('malformed token');
  const [headerSeg, payloadSeg, signatureSeg] = parts;

  const header = decodeJson<{ alg?: string }>(headerSeg);
  const alg = header.alg;
  const allowed =
    opts.algorithms ?? (opts.secret ? (['HS256'] as JwtAlgorithm[]) : opts.publicKey ? (['RS256'] as JwtAlgorithm[]) : []);
  if (!alg || !allowed.includes(alg as JwtAlgorithm)) throw new JwtError('unsupported algorithm');

  const signingInput = Buffer.from(`${headerSeg}.${payloadSeg}`, 'utf8');
  const signature = decodeSegment(signatureSeg);

  if (alg === 'HS256') {
    if (!opts.secret) throw new JwtError('missing signing secret');
    const expected = createHmac('sha256', opts.secret).update(signingInput).digest();
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) throw new JwtError('bad signature');
  } else {
    if (!opts.publicKey) throw new JwtError('missing public key');
    if (!verifySignature('RSA-SHA256', signingInput, opts.publicKey, signature)) throw new JwtError('bad signature');
  }

  const claims = decodeJson<JwtClaims>(payloadSeg);
  const nowSec = Math.floor((opts.now?.() ?? Date.now()) / 1000);
  const tolerance = opts.clockToleranceSec ?? 0;

  if (typeof claims.exp === 'number' && nowSec > claims.exp + tolerance) throw new JwtError('token expired');
  if (typeof claims.nbf === 'number' && nowSec + tolerance < claims.nbf) throw new JwtError('token not yet valid');
  if (opts.issuer && claims.iss !== opts.issuer) throw new JwtError('bad issuer');
  if (opts.audience) {
    const aud = claims.aud;
    const ok = Array.isArray(aud) ? aud.includes(opts.audience) : aud === opts.audience;
    if (!ok) throw new JwtError('bad audience');
  }
  if (typeof claims.sub !== 'string' || claims.sub.length === 0) throw new JwtError('missing subject');
  return claims;
}
