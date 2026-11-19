import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  authorizeUrl,
  createPkcePair,
  matchesAuthRequest,
  openState,
  pkceChallenge,
  randomToken,
  safeReturnPath,
  sealState,
  tokenEndpoint,
  type AuthRequest,
  type OidcConfig,
} from './oidc';

const SECRET = 'state-secret';
const nowSec = 1_700_000_000;
const now = () => nowSec * 1000;

const config: OidcConfig = {
  issuer: 'https://id.example/realms/ag',
  clientId: 'ag-gateway',
  redirectUri: 'https://api.example/gateway/auth/callback',
  scopes: 'profile email',
};

const request = (over: Partial<AuthRequest> = {}): AuthRequest => ({
  state: 'st',
  nonce: 'no',
  codeVerifier: 'verifier-'.padEnd(43, 'x'),
  returnTo: '/orders',
  expiresAt: nowSec + 600,
  ...over,
});

describe('createPkcePair', () => {
  it('produces a 43-character base64url verifier and its S256 challenge', () => {
    const pair = createPkcePair();
    expect(pair.verifier).toHaveLength(43);
    expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pair.method).toBe('S256');
    expect(pair.challenge).toBe(
      createHash('sha256').update(pair.verifier).digest('base64url'),
    );
  });

  it('never repeats a verifier', () => {
    const seen = new Set(Array.from({ length: 50 }, () => createPkcePair().verifier));
    expect(seen.size).toBe(50);
  });

  it('pkceChallenge is the RFC 7636 example', () => {
    // The worked example from RFC 7636 Appendix B.
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});

describe('randomToken', () => {
  it('is 43 base64url characters and unique', () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(randomToken());
  });
});

describe('sealState / openState', () => {
  it('round-trips a request', () => {
    const sealed = sealState(request(), SECRET);
    expect(openState(sealed, SECRET, now)).toMatchObject({ returnTo: '/orders', nonce: 'no' });
  });

  it('rejects a state signed with another secret', () => {
    const sealed = sealState(request(), 'other-secret');
    expect(openState(sealed, SECRET, now)).toBeUndefined();
  });

  it('rejects a tampered payload', () => {
    const sealed = sealState(request(), SECRET);
    const [payload, signature] = sealed.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...request(), returnTo: 'https://evil.example' }),
    ).toString('base64url');
    expect(openState(`${forged}.${signature}`, SECRET, now)).toBeUndefined();
    // And the original payload with the original signature still works, so the
    // rejection above is the signature check, not a broken parse.
    expect(openState(`${payload}.${signature}`, SECRET, now)).toBeDefined();
  });

  it('rejects an expired state', () => {
    const sealed = sealState(request({ expiresAt: nowSec - 1 }), SECRET);
    expect(openState(sealed, SECRET, now)).toBeUndefined();
  });

  it('rejects malformed input rather than throwing', () => {
    for (const bad of ['', 'nope', 'a.b.c', '.', 'abc.def']) {
      expect(openState(bad, SECRET, now), bad).toBeUndefined();
    }
    expect(openState(undefined as unknown as string, SECRET, now)).toBeUndefined();
  });

  it('rejects a valid signature over a payload that is not an AuthRequest', () => {
    const payload = Buffer.from(JSON.stringify({ hello: 'world' })).toString('base64url');
    const { createHmac } = require('node:crypto');
    const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
    expect(openState(`${payload}.${sig}`, SECRET, now)).toBeUndefined();
  });
});

describe('authorizeUrl', () => {
  const url = authorizeUrl(config, { state: 's', nonce: 'n', codeChallenge: 'c' });
  const parsed = new URL(url);

  it('points at the issuer authorisation endpoint', () => {
    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      'https://id.example/realms/ag/protocol/openid-connect/auth',
    );
  });

  it('asks for an authorisation code with PKCE S256', () => {
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('code_challenge')).toBe('c');
    expect(parsed.searchParams.get('state')).toBe('s');
    expect(parsed.searchParams.get('nonce')).toBe('n');
  });

  it('always requests the openid scope, and keeps configured ones', () => {
    const scope = parsed.searchParams.get('scope')!.split(' ');
    expect(scope).toContain('openid');
    expect(scope).toContain('profile');
    expect(scope).toContain('email');
  });

  it('forces a fresh login so a shared office browser cannot inherit a session', () => {
    expect(parsed.searchParams.get('prompt')).toBe('login');
  });

  it('tolerates a trailing slash on the issuer', () => {
    const withSlash = authorizeUrl({ ...config, issuer: 'https://id.example/realms/ag/' }, {
      state: 's',
      nonce: 'n',
      codeChallenge: 'c',
    });
    expect(withSlash).not.toContain('ag//protocol');
  });

  it('derives the token endpoint from the issuer', () => {
    expect(tokenEndpoint(config.issuer)).toBe(
      'https://id.example/realms/ag/protocol/openid-connect/token',
    );
  });
});

describe('matchesAuthRequest', () => {
  it('accepts a token minted for this flow', () => {
    expect(matchesAuthRequest({ nonce: 'no', aud: 'ag-gateway' }, { nonce: 'no' }, 'ag-gateway')).toBe(
      true,
    );
  });

  it('accepts an audience array that contains the client', () => {
    expect(
      matchesAuthRequest({ nonce: 'no', aud: ['other', 'ag-gateway'] }, { nonce: 'no' }, 'ag-gateway'),
    ).toBe(true);
  });

  it('rejects a replayed token from another flow', () => {
    expect(matchesAuthRequest({ nonce: 'other', aud: 'ag-gateway' }, { nonce: 'no' }, 'ag-gateway')).toBe(
      false,
    );
  });

  it('rejects a token for another client', () => {
    expect(matchesAuthRequest({ nonce: 'no', aud: 'other' }, { nonce: 'no' }, 'ag-gateway')).toBe(false);
  });
});

describe('safeReturnPath', () => {
  it('keeps a same-origin path', () => {
    expect(safeReturnPath('/orders')).toBe('/orders');
    expect(safeReturnPath('/orders?tab=open#top')).toBe('/orders?tab=open#top');
    // A colon in a path segment is not a scheme.
    expect(safeReturnPath('/orders/abc:1')).toBe('/orders/abc:1');
  });

  it('refuses an absolute URL', () => {
    expect(safeReturnPath('https://evil.example')).toBe('/');
    expect(safeReturnPath('javascript:alert(1)')).toBe('/');
  });

  it('refuses protocol-relative and backslash forms', () => {
    expect(safeReturnPath('//evil.example')).toBe('/');
    expect(safeReturnPath('/\\evil.example')).toBe('/');
  });

  it('refuses control characters that can smuggle a scheme', () => {
    expect(safeReturnPath('/ok\r\nLocation: https://evil.example')).toBe('/');
    expect(safeReturnPath('/ok\t')).toBe('/');
  });

  it('falls back for empty or missing input', () => {
    expect(safeReturnPath(undefined)).toBe('/');
    expect(safeReturnPath('')).toBe('/');
    expect(safeReturnPath(undefined, '/dashboard')).toBe('/dashboard');
  });
});
