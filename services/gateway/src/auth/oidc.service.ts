import { Inject, Injectable, Optional } from '@nestjs/common';
import { JwtClaims, verifyJwt } from '@ag/nest-auth';
import { JwksCache, cacheFresh, jwkToPem, keyIdOf, selectKey } from './jwks';
import type { Role } from '@ag/rbac';
import {
  AuthRequest,
  OidcConfig,
  jwksEndpoint,
  authorizeUrl,
  createPkcePair,
  matchesAuthRequest,
  openState,
  randomToken,
  sealState,
  tokenEndpoint,
} from './oidc';

export const OIDC_CONFIG = 'AG_OIDC_CONFIG';
export const OIDC_HTTP = 'AG_OIDC_HTTP';
export const OIDC_CLOCK = 'AG_OIDC_CLOCK';

/** Just enough of `fetch` to swap in tests. */
export type OidcFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface OidcEnvConfig extends OidcConfig {
  /** Secret that signs `state` and the session cookies. */
  stateSecret: string;
  /** How long a half-finished login stays valid. */
  stateMinutes: number;
  /** HS256 secret for the id token, for a realm that signs with one. */
  idTokenSecret?: string;
  /** RS256 public key for the id token, for the usual realm. */
  idTokenPublicKey?: string;
  /**
   * Pinned JWKS, for tests and for an air-gapped realm. When absent the set is
   * fetched from the issuer and cached.
   */
  jwks?: { keys: unknown[] };
}

export function oidcConfigFromEnv(env: NodeJS.ProcessEnv = process.env): OidcEnvConfig {
  return {
    issuer: env.OIDC_ISSUER ?? '',
    clientId: env.OIDC_CLIENT_ID ?? '',
    redirectUri: env.OIDC_REDIRECT_URI ?? '',
    scopes: env.OIDC_SCOPES ?? 'profile email',
    stateSecret: env.JWT_SECRET ?? '',
    stateMinutes: Number(env.OIDC_STATE_MINUTES ?? 10),
    idTokenSecret: env.OIDC_ID_TOKEN_SECRET,
    idTokenPublicKey: env.OIDC_ID_TOKEN_PUBLIC_KEY,
  };
}

/** What a completed sign-in hands back to the controller. */
export interface SignedIn {
  claims: SessionClaimsFromIdToken;
  returnTo: string;
  /** Opaque; the controller stores it and later exchanges it for a session. */
  refreshSeed: string;
  refreshIssuedAtMs: number;
}

export interface SessionClaimsFromIdToken {
  sub: string;
  roles: Role[];
  orgId?: string;
  email?: string;
}

/**
 * The authorisation-code + PKCE flow, composed from the pure rules in `oidc.ts`.
 *
 * The controller owns HTTP (redirects and cookies); this owns the sequence and
 * the network calls to the IdP, so the whole exchange can be tested against a
 * fake IdP with no Nest application and no browser.
 */
@Injectable()
export class OidcService {
  private jwks?: JwksCache;
  private inflight?: Promise<JwksCache | undefined>;

  constructor(
    @Optional() @Inject(OIDC_CONFIG) private readonly config: OidcEnvConfig,
    @Optional() @Inject(OIDC_HTTP) private readonly http: OidcFetch = fetch as unknown as OidcFetch,
    @Optional() @Inject(OIDC_CLOCK) private readonly now: () => number = Date.now,
  ) {}

  /** Whether sign-in is configured at all; the controller answers 503 if not. */
  get configured(): boolean {
    return Boolean(this.config?.issuer && this.config.clientId && this.config.redirectUri);
  }

  /**
   * Starts a login: returns where to send the browser and the sealed state to
   * put in a cookie. The state carries the PKCE verifier, so the callback does
   * not need a server-side session store.
   */
  begin(returnTo: string | undefined): { url: string; state: string } {
    const pkce = createPkcePair();
    const request: AuthRequest = {
      state: randomToken(),
      nonce: randomToken(),
      codeVerifier: pkce.verifier,
      returnTo: returnTo ?? '/',
      expiresAt: Math.floor(this.now() / 1000) + this.config.stateMinutes * 60,
    };
    const state = sealState(request, this.config.stateSecret);
    const url = authorizeUrl(this.config, {
      state,
      nonce: request.nonce,
      codeChallenge: pkce.challenge,
    });
    return { url, state };
  }

  /**
   * Completes a login. Verifies the state, exchanges the code, checks the id
   * token against the nonce and audience, and returns the caller plus where to
   * send them.
   *
   * Returns `undefined` for anything that fails, so the controller can answer
   * one indistinguishable 401: which part failed is not the caller's business
   * and telling them would help an attacker.
   */
  async complete(
    sealedState: string | undefined,
    code: string | undefined,
  ): Promise<SignedIn | undefined> {
    if (!sealedState || !code) return undefined;

    const request = openState(sealedState, this.config.stateSecret, this.now);
    if (!request) return undefined;

    const tokens = await this.exchangeCode(code, request.codeVerifier);
    if (!tokens) return undefined;

    const claims = await this.verifyIdToken(tokens.id_token);
    if (!claims) return undefined;
    if (!matchesAuthRequest(claims, request, this.config.clientId)) return undefined;

    return {
      claims: {
        sub: String(claims.sub),
        roles: rolesFromIdToken(claims),
        orgId: typeof claims.org_id === 'string' ? claims.org_id : undefined,
        email: typeof claims.email === 'string' ? claims.email : undefined,
      },
      returnTo: request.returnTo,
      refreshSeed: tokens.refresh_token ?? '',
      refreshIssuedAtMs: this.now(),
    };
  }

  private async exchangeCode(
    code: string,
    verifier: string,
  ): Promise<{ id_token?: string; refresh_token?: string } | undefined> {
    try {
      const res = await this.http(tokenEndpoint(this.config.issuer), {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.config.redirectUri,
          client_id: this.config.clientId,
          code_verifier: verifier,
        }).toString(),
      });
      if (!res.ok) return undefined;
      return (await res.json()) as { id_token?: string; refresh_token?: string };
    } catch {
      // A network failure is a failed sign-in, not a 500 for the caller.
      return undefined;
    }
  }

  /**
   * Verifies the id token against the realm's keys.
   *
   * A realm usually signs RS256, so the key comes from its JWKS and the token's
   * `kid` chooses which. A pinned key or an HS256 secret is honoured first,
   * which is what a test or an air-gapped realm needs.
   */
  private async verifyIdToken(idToken: string | undefined): Promise<JwtClaims | undefined> {
    if (!idToken) return undefined;
    const options = {
      issuer: this.config.issuer,
      audience: this.config.clientId,
      clockToleranceSec: 30,
      now: this.now,
    };

    if (this.config.idTokenSecret) {
      try {
        return verifyJwt(idToken, { ...options, secret: this.config.idTokenSecret });
      } catch {
        return undefined;
      }
    }

    const publicKey = this.config.idTokenPublicKey ?? (await this.keyFor(idToken));
    if (!publicKey) return undefined;
    try {
      return verifyJwt(idToken, { ...options, publicKey });
    } catch {
      return undefined;
    }
  }

  /**
   * The PEM of the key that signed this token, from the cached set.
   *
   * An unknown `kid` forces one refetch before giving up: that is exactly what
   * a key rotation looks like, and refusing until the TTL lapses would reject
   * every sign-in for ten minutes after the IdP rotates.
   */
  private async keyFor(idToken: string): Promise<string | undefined> {
    const kid = keyIdOf(idToken);
    const cached = selectKey(this.jwks?.keys ?? [], kid);
    if (cached) return jwkToPem(cached);

    const fetched = await this.fetchJwks();
    const key = fetched ? selectKey(fetched.keys, kid) : undefined;
    return key ? jwkToPem(key) : undefined;
  }

  /** The JWKS, from cache when fresh. One fetch at a time, so a burst of
   * sign-ins after a rotation does not stampede the IdP. */
  private async fetchJwks(): Promise<JwksCache | undefined> {
    const now = this.now();
    if (cacheFresh(this.jwks, now)) return this.jwks;

    const pinned = this.config.jwks;
    if (pinned) {
      const cache = { keys: pinned.keys as any[], fetchedAt: now };
      this.jwks = cache;
      return cache;
    }

    this.inflight ??= this.downloadJwks(now);
    try {
      return await this.inflight;
    } finally {
      this.inflight = undefined;
    }
  }

  private async downloadJwks(now: number): Promise<JwksCache | undefined> {
    try {
      const res = await this.http(jwksEndpoint(this.config.issuer));
      if (!res.ok) return undefined;
      const body = (await res.json()) as { keys?: unknown[] };
      if (!Array.isArray(body.keys)) return undefined;
      const cache = { keys: body.keys as any[], fetchedAt: now };
      this.jwks = cache;
      return cache;
    } catch {
      return undefined;
    }
  }
}

/**
 * Staff roles from the id token. Keycloak puts them under `realm_access.roles`;
 * a flat `roles` claim is accepted too. Anything that is not a known role is
 * dropped, so an IdP misconfiguration grants nothing rather than everything.
 */
export function rolesFromIdToken(claims: JwtClaims, known?: (role: string) => boolean): Role[] {
  const raw = claims.roles ?? claims.realm_access?.roles ?? [];
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is Role => typeof r === 'string' && (known ? known(r) : true));
}
