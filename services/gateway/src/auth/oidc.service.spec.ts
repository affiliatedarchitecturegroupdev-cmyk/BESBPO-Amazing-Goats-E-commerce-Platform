import { describe, expect, it, vi } from 'vitest';
import { signJwt } from '@ag/nest-auth';
import { generateKeyPairSync, sign as signRsa } from 'node:crypto';
import { OidcService, oidcConfigFromEnv, rolesFromIdToken, type OidcEnvConfig, type OidcFetch } from './oidc.service';
import { openState } from './oidc';

const nowSec = 1_700_000_000;
const now = () => nowSec * 1000;
const SECRET = 'state-secret';

const config: OidcEnvConfig = {
  issuer: 'https://id.example/realms/ag',
  clientId: 'ag-gateway',
  redirectUri: 'https://api.example/gateway/auth/callback',
  scopes: 'profile email',
  stateSecret: SECRET,
  stateMinutes: 10,
  idTokenSecret: 'idp-secret',
};

/** A fake IdP that mints a valid id token and echoes the code it was given. */
function fakeIdp(overrides: { nonce?: string; aud?: string } = {}) {
  return vi.fn<OidcFetch>(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      id_token: signJwt(
        {
          sub: 'user-1',
          iss: config.issuer,
          aud: overrides.aud ?? config.clientId,
          nonce: overrides.nonce ?? 'NONCE',
          roles: ['ops_manager', 'not_a_role'],
          org_id: 'org-9',
          email: 'ops@amazinggoats.co.za',
          exp: nowSec + 300,
        },
        { secret: 'idp-secret', now },
      ),
      refresh_token: 'refresh-abc',
    }),
  }));
}

/** A fake IdP that mints a token for the nonce the flow actually requested. */
function workingService() {
  const nonce = { value: '' };
  const http: OidcFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      id_token: signJwt(
        {
          sub: 'user-1',
          iss: config.issuer,
          aud: config.clientId,
          nonce: nonce.value,
          roles: ['ops_manager'],
          org_id: 'org-9',
          email: 'ops@amazinggoats.co.za',
          exp: nowSec + 300,
        },
        { secret: 'idp-secret', now },
      ),
      refresh_token: 'refresh-abc',
    }),
  });
  const service = new OidcService(config, http, now);
  const begin = service.begin('/orders');
  // The nonce the IdP would echo is the one in the URL it was sent.
  nonce.value = new URL(begin.url).searchParams.get('nonce')!;
  return { service, state: begin.state, setNonce: (n: string) => (nonce.value = n) };
}

describe('OidcService.begin', () => {
  it('returns an IdP URL and a state that carries the return path', () => {
    const service = new OidcService(config, fakeIdp(), now);
    const { url, state } = service.begin('/orders');
    expect(url).toContain('https://id.example/realms/ag/protocol/openid-connect/auth');
    expect(openState(state, SECRET, now)?.returnTo).toBe('/orders');
  });

  it('embeds the PKCE challenge that matches the sealed verifier', () => {
    const service = new OidcService(config, fakeIdp(), now);
    const { url, state } = service.begin('/');
    const challenge = new URL(url).searchParams.get('code_challenge');
    const verifier = openState(state, SECRET, now)!.codeVerifier;
    expect(challenge).toBe(
      require('node:crypto').createHash('sha256').update(verifier).digest('base64url'),
    );
  });

  it('defaults the return path to /', () => {
    const service = new OidcService(config, fakeIdp(), now);
    const { state } = service.begin(undefined);
    expect(openState(state, SECRET, now)?.returnTo).toBe('/');
  });

  it('reports not configured when the issuer is missing', () => {
    expect(new OidcService({ ...config, issuer: '' }, fakeIdp(), now).configured).toBe(false);
    expect(new OidcService(config, fakeIdp(), now).configured).toBe(true);
  });
});

describe('OidcService.complete', () => {
  it('exchanges a code for a session when the token matches the flow', async () => {
    const { service, state } = workingService();
    const result = await service.complete(state, 'the-code');
    expect(result?.claims.sub).toBe('user-1');
    expect(result?.claims.roles).toEqual(['ops_manager']);
    expect(result?.claims.orgId).toBe('org-9');
    expect(result?.returnTo).toBe('/orders');
    expect(result?.refreshSeed).toBe('refresh-abc');
  });

  it('refuses a code without the state that started the flow', async () => {
    const service = new OidcService(config, fakeIdp(), now);
    expect(await service.complete(undefined, 'code')).toBeUndefined();
    expect(await service.complete('forged.state', 'code')).toBeUndefined();
  });

  it('refuses a missing code', async () => {
    const { service, state } = workingService();
    expect(await service.complete(state, undefined)).toBeUndefined();
  });

  it('refuses a token minted for a different nonce', async () => {
    const { service, state, setNonce } = workingService();
    setNonce('a-different-nonce');
    expect(await service.complete(state, 'code')).toBeUndefined();
  });

  it('refuses a token for a different audience', async () => {
    const { service, state } = workingService();
    const http: OidcFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id_token: signJwt(
          { sub: 'u', iss: config.issuer, aud: 'another-client', nonce: 'x', exp: nowSec + 300 },
          { secret: 'idp-secret', now },
        ),
      }),
    });
    const other = new OidcService(config, http, now);
    expect(await other.complete(state, 'code')).toBeUndefined();
    // The working service still succeeds, so the refusal is the audience check.
    expect(await service.complete(state, 'code')).toBeDefined();
  });

  it('refuses an expired state', async () => {
    const service = new OidcService(config, fakeIdp(), () => (nowSec + 3600) * 1000);
    const { state } = new OidcService(config, fakeIdp(), now).begin('/');
    expect(await service.complete(state, 'code')).toBeUndefined();
  });

  it('treats an IdP error response as a failed sign-in, not a crash', async () => {
    const http: OidcFetch = async () => ({ ok: false, status: 400, json: async () => ({}) });
    const service = new OidcService(config, http, now);
    const { state } = service.begin('/');
    expect(await service.complete(state, 'code')).toBeUndefined();
  });

  it('treats a network failure as a failed sign-in, not a 500', async () => {
    const http: OidcFetch = async () => {
      throw new Error('ECONNREFUSED');
    };
    const service = new OidcService(config, http, now);
    const { state } = service.begin('/');
    expect(await service.complete(state, 'code')).toBeUndefined();
  });

  it('refuses a token signed with the wrong key', async () => {
    const http: OidcFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id_token: signJwt(
          { sub: 'u', iss: config.issuer, aud: config.clientId, nonce: 'n', exp: nowSec + 300 },
          { secret: 'wrong-key', now },
        ),
      }),
    });
    const service = new OidcService(config, http, now);
    const { state } = service.begin('/');
    expect(await service.complete(state, 'code')).toBeUndefined();
  });

  it('sends the code verifier and redirect URI the IdP expects', async () => {
    const http = vi.fn<OidcFetch>(async () => ({ ok: false, status: 400, json: async () => ({}) }));
    const service = new OidcService(config, http, now);
    const { state } = service.begin('/');
    await service.complete(state, 'the-code');
    const body = new URLSearchParams(http.mock.calls[0][1]!.body as string);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('the-code');
    expect(body.get('code_verifier')).toBe(openState(state, SECRET, now)!.codeVerifier);
    expect(body.get('redirect_uri')).toBe(config.redirectUri);
  });
});

describe('rolesFromIdToken', () => {
  it('reads a flat roles claim', () => {
    expect(rolesFromIdToken({ sub: 'u', roles: ['executive'] })).toEqual(['executive']);
  });

  it('reads Keycloak realm_access roles', () => {
    expect(rolesFromIdToken({ sub: 'u', realm_access: { roles: ['finance'] } })).toEqual(['finance']);
  });

  it('drops non-strings and unknown roles rather than granting them', () => {
    const claims = { sub: 'u', roles: ['executive', 42, null, 'superuser'] };
    expect(rolesFromIdToken(claims, (r) => r !== 'superuser')).toEqual(['executive']);
  });

  it('returns nothing when there is no roles claim', () => {
    expect(rolesFromIdToken({ sub: 'u' })).toEqual([]);
  });
});

describe('oidcConfigFromEnv', () => {
  it('reads the environment and defaults the scope', () => {
    const c = oidcConfigFromEnv({
      OIDC_ISSUER: 'https://id.example/realms/ag',
      OIDC_CLIENT_ID: 'ag',
      OIDC_REDIRECT_URI: 'https://api/cb',
      JWT_SECRET: 's',
    });
    expect(c.clientId).toBe('ag');
    expect(c.scopes).toBe('profile email');
    expect(c.stateSecret).toBe('s');
  });
});


describe('OidcService with a real RS256 realm (JWKS)', () => {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

  function realm() {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'realm-key-1', alg: 'RS256', use: 'sig' };
    const mint = (over: Record<string, unknown> = {}) => {
      const header = b64({ alg: 'RS256', typ: 'JWT', kid: 'realm-key-1' });
      const payload = b64({
        sub: 'user-9',
        iss: config.issuer,
        aud: config.clientId,
        nonce: 'NONCE',
        roles: ['executive'],
        exp: nowSec + 300,
        ...over,
      });
      return `${header}.${payload}.${signRsa('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url')}`;
    };
    return { jwk, mint };
  }

  const rsConfig: OidcEnvConfig = { ...config, idTokenSecret: undefined, idTokenPublicKey: undefined };

  it('verifies an RS256 id token against the realm JWKS', async () => {
    const { jwk, mint } = realm();
    const nonce = { current: '' };
    let certFetches = 0;
    const http: OidcFetch = async (url) => {
      if (url.endsWith('/certs')) {
        certFetches++;
        return { ok: true, status: 200, json: async () => ({ keys: [jwk] }) };
      }
      return { ok: true, status: 200, json: async () => ({ id_token: mint({ nonce: nonce.current }), refresh_token: 'r' }) };
    };
    const service = new OidcService(rsConfig, http, now);
    const { url, state } = service.begin('/trade');
    nonce.current = new URL(url).searchParams.get('nonce')!;

    const result = await service.complete(state, 'code');
    expect(result?.claims.sub).toBe('user-9');
    expect(result?.claims.roles).toEqual(['executive']);
    expect(certFetches).toBe(1);
  });

  it('caches the JWKS across sign-ins instead of fetching per request', async () => {
    const { jwk, mint } = realm();
    const nonce = { current: '' };
    let certFetches = 0;
    const http: OidcFetch = async (url) => {
      if (url.endsWith('/certs')) {
        certFetches++;
        return { ok: true, status: 200, json: async () => ({ keys: [jwk] }) };
      }
      return { ok: true, status: 200, json: async () => ({ id_token: mint({ nonce: nonce.current }), refresh_token: 'r' }) };
    };
    const service = new OidcService(rsConfig, http, now);

    for (let i = 0; i < 3; i++) {
      const { url, state } = service.begin('/');
      nonce.current = new URL(url).searchParams.get('nonce')!;
      expect(await service.complete(state, 'code')).toBeDefined();
    }
    expect(certFetches).toBe(1);
  });

  it('refuses an RS256 token signed by a key the realm does not publish', async () => {
    const { mint } = realm();
    const other = realm();
    const nonce = { current: '' };
    const http: OidcFetch = async (url) => {
      if (url.endsWith('/certs')) {
        return { ok: true, status: 200, json: async () => ({ keys: [other.jwk] }) };
      }
      return { ok: true, status: 200, json: async () => ({ id_token: mint({ nonce: nonce.current }) }) };
    };
    const service = new OidcService(rsConfig, http, now);
    const { url, state } = service.begin('/');
    nonce.current = new URL(url).searchParams.get('nonce')!;
    expect(await service.complete(state, 'code')).toBeUndefined();
  });

  it('fails closed when the JWKS endpoint is unreachable', async () => {
    const http: OidcFetch = async (url) => {
      if (url.endsWith('/certs')) throw new Error('ENOTFOUND');
      return { ok: true, status: 200, json: async () => ({ id_token: 'x.y.z' }) };
    };
    const service = new OidcService(rsConfig, http, now);
    const { state } = service.begin('/');
    expect(await service.complete(state, 'code')).toBeUndefined();
  });
});
