import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export { safeReturnPath } from '@ag/rbac';

/**
 * The OIDC sign-in front door (`docs/02-access-control.md`, T-058): the pure
 * half of the authorisation-code + PKCE flow. No Nest, no HTTP — the controller
 * composes these, so every rule here is testable without a server.
 */

/** Where the IdP lives and who we are to it. */
export interface OidcConfig {
  /** Realm or tenant issuer, e.g. `https://id.amazinggoats.co.za/realms/ag`. */
  issuer: string;
  clientId: string;
  /** Must match a redirect URI registered with the IdP, exactly. */
  redirectUri: string;
  /** Space-separated; `openid` is always added. */
  scopes?: string;
}

export interface PkcePair {
  verifier: string;
  challenge: string;
  method: 'S256';
}

/** The query a callback must echo back to be accepted. */
export interface AuthRequest {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  /** Unix seconds; a stale login that is never completed must expire. */
  expiresAt: number;
}

/**
 * A PKCE verifier is 43–128 characters of `[A-Za-z0-9-._~]`. 32 random bytes in
 * base64url is 43 characters, the minimum and the common choice.
 */
export function createPkcePair(rand: (n: number) => Buffer = randomBytes): PkcePair {
  const verifier = rand(32).toString('base64url');
  return { verifier, challenge: pkceChallenge(verifier), method: 'S256' };
}

/** `BASE64URL(SHA256(verifier))`, per RFC 7636. */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * A value that only this server can produce, so a callback carrying it was
 * started here. 32 bytes of randomness; not a secret the IdP ever sees twice.
 */
export function randomToken(rand: (n: number) => Buffer = randomBytes): string {
  return rand(32).toString('base64url');
}

/**
 * The `state` parameter. It is signed rather than stored server-side so a
 * callback can be validated by a stateless replica — which is what a rolling
 * deploy gives you — while still carrying the PKCE verifier and return path
 * across the redirect.
 *
 * Format: `base64url(json).base64url(hmac)`. The payload is readable (it holds
 * no secret beyond the short-lived verifier, which is useless without the
 * `code`) but not forgeable.
 */
export function sealState(request: AuthRequest, secret: string): string {
  const payload = Buffer.from(JSON.stringify(request)).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Returns the request if the signature is good and the state has not expired,
 * else `undefined`. A bad signature, a malformed payload and an expired state
 * are all the same answer to the caller: start again.
 */
export function openState(
  state: string,
  secret: string,
  now: () => number = Date.now,
): AuthRequest | undefined {
  if (typeof state !== 'string') return undefined;
  const parts = state.split('.');
  if (parts.length !== 2) return undefined;
  const [payload, signature] = parts;

  const expected = sign(payload, secret);
  if (!constantTimeEquals(signature, expected)) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
  if (!isAuthRequest(parsed)) return undefined;
  if (parsed.expiresAt * 1000 <= now()) return undefined;
  return parsed;
}

function isAuthRequest(value: unknown): value is AuthRequest {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.state === 'string' &&
    typeof v.nonce === 'string' &&
    typeof v.codeVerifier === 'string' &&
    typeof v.returnTo === 'string' &&
    typeof v.expiresAt === 'number'
  );
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Builds the authorisation URL to redirect the browser to.
 *
 * `prompt=login` is deliberate: a shared office browser must not silently sign
 * the next person in as the last one. `response_mode=query` keeps the callback
 * a plain GET, which is what a server-side exchange expects.
 */
export function authorizeUrl(
  config: OidcConfig,
  params: { state: string; nonce: string; codeChallenge: string },
): string {
  const scopes = new Set(['openid', ...(config.scopes ?? '').split(' ').filter(Boolean)]);
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: [...scopes].join(' '),
    state: params.state,
    nonce: params.nonce,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'login',
  });
  return `${config.issuer.replace(/\/$/, '')}/protocol/openid-connect/auth?${query.toString()}`;
}

/** The token endpoint for an issuer, in Keycloak's layout. */
export function tokenEndpoint(issuer: string): string {
  return `${issuer.replace(/\/$/, '')}/protocol/openid-connect/token`;
}

/** The JWKS the id token's signature is checked against. */
export function jwksEndpoint(issuer: string): string {
  return `${issuer.replace(/\/$/, '')}/protocol/openid-connect/certs`;
}

/**
 * Whether a token's claims match the request that started the login. The
 * `nonce` binds the id token to this browser's flow, so a token minted for
 * another session cannot be replayed here.
 */
export function matchesAuthRequest(
  claims: { nonce?: unknown; aud?: unknown },
  request: Pick<AuthRequest, 'nonce'>,
  clientId: string,
): boolean {
  if (claims.nonce !== request.nonce) return false;
  const aud = claims.aud;
  return Array.isArray(aud) ? aud.includes(clientId) : aud === clientId;
}
