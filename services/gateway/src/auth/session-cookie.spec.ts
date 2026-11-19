import { describe, expect, it } from 'vitest';
import { userFromRequest } from '@ag/nest-auth';
import {
  REFRESH_COOKIE,
  SESSION_COOKIE,
  STATE_COOKIE,
  clearCookie,
  cookieFromRequest,
  issueSession,
  parseCookies,
  refreshCookie,
  refreshExpired,
  sessionConfigFromEnv,
  sessionCookie,
  stateCookie,
  type SessionConfig,
} from './session-cookie';

const nowSec = 1_700_000_000;
const now = () => nowSec * 1000;

const config: SessionConfig = {
  secret: 'session-secret',
  sessionMinutes: 15,
  refreshMinutes: 480,
  secure: true,
  path: '/',
};

const attributes = (cookie: string) =>
  Object.fromEntries(
    cookie
      .split(';')
      .map((p) => p.trim())
      .filter((p) => p.includes('=') || p === 'HttpOnly' || p === 'Secure')
      .map((p) => {
        const i = p.indexOf('=');
        return i === -1 ? [p, true] : [p.slice(0, i), p.slice(i + 1)];
      }),
  );

describe('issueSession', () => {
  it('mints a token the guard already resolves', () => {
    // The whole point of the session: `userFromRequest` is unchanged and reads
    // the token we issue, so no guard change is needed for sign-in.
    const token = issueSession(
      { sub: 'u-1', roles: ['ops_manager'], org_id: 'org-9' },
      config,
      now,
    );
    const user = userFromRequest(
      { headers: { authorization: `Bearer ${token}` } },
      { secret: config.secret, now },
    );
    expect(user).toEqual({ id: 'u-1', roles: ['ops_manager'], orgId: 'org-9' });
  });

  it('expires after the configured session length, not a default', () => {
    const token = issueSession({ sub: 'u', roles: ['executive'] }, config, now);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(payload.exp).toBe(nowSec + 15 * 60);
    expect(payload.iat).toBe(nowSec);
  });

  it('is rejected by the guard once it expires', () => {
    const token = issueSession({ sub: 'u', roles: ['executive'] }, config, now);
    const later = { secret: config.secret, now: () => (nowSec + 16 * 60) * 1000 };
    expect(userFromRequest({ headers: { authorization: `Bearer ${token}` } }, later)).toBeUndefined();
  });

  it('is rejected when verified with a different secret', () => {
    const token = issueSession({ sub: 'u', roles: ['executive'] }, config, now);
    expect(
      userFromRequest({ headers: { authorization: `Bearer ${token}` } }, { secret: 'other', now }),
    ).toBeUndefined();
  });
});

describe('cookies', () => {
  it('sets httpOnly, SameSite=Lax and Secure on the session cookie', () => {
    const attrs = attributes(sessionCookie('tok', config));
    expect(attrs[SESSION_COOKIE]).toBe('tok');
    expect(attrs.HttpOnly).toBe(true);
    expect(attrs.Secure).toBe(true);
    expect(attrs.SameSite).toBe('Lax');
    expect(attrs['Max-Age']).toBe(String(15 * 60));
  });

  it('omits Secure only when the config says so, for local HTTP', () => {
    const attrs = attributes(sessionCookie('tok', { ...config, secure: false }));
    expect(attrs.Secure).toBeUndefined();
    expect(attrs.HttpOnly).toBe(true);
  });

  it('gives the refresh a longer life than the session', () => {
    const session = attributes(sessionCookie('t', config))['Max-Age'];
    const refresh = attributes(refreshCookie('r', config))['Max-Age'];
    expect(Number(refresh)).toBeGreaterThan(Number(session));
  });

  it('keeps the PKCE state short lived', () => {
    expect(Number(attributes(stateCookie('s', config))['Max-Age'])).toBe(10 * 60);
  });

  it('clears a cookie with the same attributes and no value', () => {
    const attrs = attributes(clearCookie(SESSION_COOKIE, config));
    expect(attrs[SESSION_COOKIE]).toBe('');
    expect(attrs['Max-Age']).toBe('0');
    expect(attrs.HttpOnly).toBe(true);
    expect(attrs.Secure).toBe(true);
  });

  it('uses the refresh and state cookie names the controller sets', () => {
    expect(REFRESH_COOKIE).toBe('ag_refresh');
    expect(STATE_COOKIE).toBe('ag_oidc_state');
  });
});

describe('parseCookies / cookieFromRequest', () => {
  it('parses a header into a map', () => {
    expect(parseCookies('a=1; b=2')).toEqual({ a: '1', b: '2' });
  });

  it('skips junk pairs instead of failing', () => {
    expect(parseCookies('=nope; ok=1; ; bad')).toEqual({ ok: '1' });
  });

  it('handles an empty or missing header', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('')).toEqual({});
  });

  it('keeps an = inside a value', () => {
    expect(parseCookies('tok=a=b=c')).toEqual({ tok: 'a=b=c' });
  });

  it('reads one cookie off a request, tolerating the array form', () => {
    expect(cookieFromRequest({ headers: { cookie: 'ag_session=x; other=y' } }, 'ag_session')).toBe('x');
    expect(cookieFromRequest({ headers: { cookie: ['ag_session=x'] } }, 'ag_session')).toBe('x');
    expect(cookieFromRequest({ headers: {} }, 'ag_session')).toBeUndefined();
  });
});

describe('sessionConfigFromEnv', () => {
  it('is short by default and Secure in production', () => {
    const fromProd = sessionConfigFromEnv({ NODE_ENV: 'production', JWT_SECRET: 's' });
    expect(fromProd.sessionMinutes).toBe(15);
    expect(fromProd.refreshMinutes).toBe(480);
    expect(fromProd.secure).toBe(true);
  });

  it('allows plain HTTP outside production', () => {
    expect(sessionConfigFromEnv({ NODE_ENV: 'development' }).secure).toBe(false);
  });

  it('honours overrides', () => {
    const c = sessionConfigFromEnv({ SESSION_MINUTES: '5', REFRESH_MINUTES: '60' });
    expect(c.sessionMinutes).toBe(5);
    expect(c.refreshMinutes).toBe(60);
  });
});

describe('refreshExpired', () => {
  it('honours a refresh inside the window', () => {
    expect(refreshExpired(nowSec * 1000, config, now)).toBe(false);
  });

  it('refuses one past the window, so a session cannot be renewed forever', () => {
    const issued = (nowSec - 481 * 60) * 1000;
    expect(refreshExpired(issued, config, now)).toBe(true);
  });
});
