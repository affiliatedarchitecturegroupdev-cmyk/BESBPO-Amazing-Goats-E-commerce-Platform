import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign as signRsa } from 'node:crypto';
import { cacheFresh, jwkToPem, keyIdOf, selectKey } from './jwks';
import { signJwt, verifyJwt } from '@ag/nest-auth';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

/** A real RSA key pair, exported as a JWK, so conversion is exercised for real. */
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'key-1', alg: 'RS256', use: 'sig' };

describe('keyIdOf', () => {
  it('reads the kid from the header', () => {
    const token = `${b64({ alg: 'RS256', kid: 'key-1' })}.${b64({ sub: 'u' })}.sig`;
    expect(keyIdOf(token)).toBe('key-1');
  });

  it('returns undefined for a token without one, or junk', () => {
    expect(keyIdOf(`${b64({ alg: 'RS256' })}.${b64({})}.sig`)).toBeUndefined();
    expect(keyIdOf('not-a-token')).toBeUndefined();
    expect(keyIdOf('a.!!!.c')).toBeUndefined();
  });
});

describe('selectKey', () => {
  const keys = [{ kid: 'a' }, { kid: 'b' }];

  it('picks the matching key', () => {
    expect(selectKey(keys, 'b')).toEqual({ kid: 'b' });
  });

  it('refuses to guess when the kid is unknown and several keys exist', () => {
    expect(selectKey(keys, 'missing')).toBeUndefined();
    expect(selectKey(keys, undefined)).toBeUndefined();
  });

  it('uses the only key when the IdP omits a kid', () => {
    expect(selectKey([{ kid: 'a' }], undefined)).toEqual({ kid: 'a' });
  });
});

describe('jwkToPem', () => {
  it('converts a real JWK and the PEM verifies a token the private key signed', () => {
    const pem = jwkToPem(jwk);
    expect(pem).toContain('BEGIN PUBLIC KEY');

    const header = b64({ alg: 'RS256', typ: 'JWT', kid: 'key-1' });
    const payload = b64({ sub: 'u-1', iss: 'https://id.example', aud: 'ag', exp: 2_000_000_000 });
    const signature = signRsa('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
    const token = `${header}.${payload}.${signature}`;

    expect(verifyJwt(token, { publicKey: pem!, issuer: 'https://id.example', audience: 'ag' }).sub).toBe('u-1');
  });

  it('returns undefined for something that is not a key at all', () => {
    expect(jwkToPem({})).toBeUndefined();
    expect(jwkToPem({ kty: 'oct', k: 'c2VjcmV0' })).toBeUndefined();
  });

  it('a leniently-parsed key still cannot verify a token, which is the real guard', () => {
    // `createPublicKey` accepts a malformed modulus rather than throwing, so
    // conversion succeeding is not the check that matters — signature
    // verification failing is. Asserting that, not the conversion.
    const pem = jwkToPem({ kty: 'RSA', n: 'not-base64', e: 'AQAB' });
    const header = b64({ alg: 'RS256', typ: 'JWT' });
    const payload = b64({ sub: 'u', exp: 2_000_000_000 });
    const signature = signRsa('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
    expect(() => verifyJwt(`${header}.${payload}.${signature}`, { publicKey: pem })).toThrow();
  });

  it('does not accept an HS256 token signed with a JWKS-derived key', () => {
    // Algorithm confusion: a public key is public, so it must never be usable
    // as an HMAC secret.
    const pem = jwkToPem(jwk)!;
    const forged = signJwt({ sub: 'u', exp: 2_000_000_000 }, { secret: pem });
    expect(() => verifyJwt(forged, { publicKey: pem })).toThrow();
  });
});

describe('cacheFresh', () => {
  it('is fresh inside the TTL and stale after', () => {
    const cache = { keys: [], fetchedAt: 1_000 };
    expect(cacheFresh(cache, 1_000 + 60_000)).toBe(true);
    expect(cacheFresh(cache, 1_000 + 11 * 60_000)).toBe(false);
  });

  it('is not fresh when nothing has been fetched', () => {
    expect(cacheFresh(undefined, 1_000)).toBe(false);
  });
});
