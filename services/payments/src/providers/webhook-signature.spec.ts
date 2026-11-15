import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  hmacSha256Hex,
  safeEqualHex,
  verifyHmacBody,
  verifyHmacSignature,
  verifySvixSignature,
} from './webhook-signature';

const secret = 'whsec_test';
const rawBody = JSON.stringify({ id: 'evt_1', result: { code: 'successful' } });
const now = new Date('2026-11-14T10:00:00Z');
const t = Math.floor(now.getTime() / 1000);

function sign(ts: number, body: string): string {
  return createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
}

describe('verifyHmacSignature', () => {
  it('accepts a well-formed, in-window signature', () => {
    const header = `t=${t},v1=${sign(t, rawBody)}`;
    expect(verifyHmacSignature({ secret, rawBody, signature: header, now })).toBe(true);
  });

  it('rejects a wrong signature', () => {
    const header = `t=${t},v1=${sign(t, rawBody).replace(/.$/, '0')}`;
    expect(verifyHmacSignature({ secret, rawBody, signature: header, now })).toBe(false);
  });

  it('rejects a tampered body', () => {
    const header = `t=${t},v1=${sign(t, rawBody)}`;
    expect(verifyHmacSignature({ secret, rawBody: rawBody + ' ', signature: header, now })).toBe(
      false,
    );
  });

  it('rejects a timestamp outside the tolerance window (replay)', () => {
    const old = t - 3600;
    const header = `t=${old},v1=${sign(old, rawBody)}`;
    expect(verifyHmacSignature({ secret, rawBody, signature: header, now })).toBe(false);
  });

  it('rejects a missing or malformed header', () => {
    expect(verifyHmacSignature({ secret, rawBody, signature: undefined, now })).toBe(false);
    expect(verifyHmacSignature({ secret, rawBody, signature: 'garbage', now })).toBe(false);
    expect(verifyHmacSignature({ secret, rawBody, signature: `v1=${sign(t, rawBody)}`, now })).toBe(
      false,
    );
  });
});

describe('verifyHmacBody', () => {
  it('accepts a body signature and rejects a wrong one', () => {
    const sig = hmacSha256Hex(secret, rawBody);
    expect(verifyHmacBody(secret, rawBody, sig)).toBe(true);
    expect(verifyHmacBody(secret, rawBody, 'deadbeef')).toBe(false);
    expect(verifyHmacBody(secret, rawBody, undefined)).toBe(false);
  });
});

describe('safeEqualHex', () => {
  it('is true only for equal strings', () => {
    expect(safeEqualHex('abcd', 'abcd')).toBe(true);
    expect(safeEqualHex('abcd', 'abce')).toBe(false);
    expect(safeEqualHex('abcd', 'abcde')).toBe(false);
  });
});

describe('verifySvixSignature', () => {
  const rawKey = Buffer.from('a-svix-signing-key').toString('base64');
  const svixSecret = `whsec_${rawKey}`;
  const body = '{"hello":"world"}';

  const sign = (id: string, ts: number, payload: string) =>
    createHmac('sha256', Buffer.from(rawKey, 'base64'))
      .update(`${id}.${ts}.${payload}`)
      .digest('base64');

  it('accepts a valid v1 signature', () => {
    expect(
      verifySvixSignature({
        secret: svixSecret,
        rawBody: body,
        id: 'msg_1',
        timestampSec: t,
        signature: `v1,${sign('msg_1', t, body)}`,
        now,
      }),
    ).toBe(true);
  });

  it('accepts a match anywhere in a space-delimited rotation list', () => {
    expect(
      verifySvixSignature({
        secret: svixSecret,
        rawBody: body,
        id: 'msg_1',
        timestampSec: t,
        signature: `v1,oldSignature v1,${sign('msg_1', t, body)}`,
        now,
      }),
    ).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(
      verifySvixSignature({
        secret: svixSecret,
        rawBody: '{"hello":"tampered"}',
        id: 'msg_1',
        timestampSec: t,
        signature: `v1,${sign('msg_1', t, body)}`,
        now,
      }),
    ).toBe(false);
  });

  it('rejects a timestamp outside the tolerance window (replay)', () => {
    const old = t - 3600;
    expect(
      verifySvixSignature({
        secret: svixSecret,
        rawBody: body,
        id: 'msg_1',
        timestampSec: old,
        signature: `v1,${sign('msg_1', old, body)}`,
        now,
      }),
    ).toBe(false);
  });

  it('rejects a missing id or signature', () => {
    expect(
      verifySvixSignature({
        secret: svixSecret,
        rawBody: body,
        id: undefined,
        timestampSec: t,
        signature: 'v1,x',
        now,
      }),
    ).toBe(false);
    expect(
      verifySvixSignature({
        secret: svixSecret,
        rawBody: body,
        id: 'msg_1',
        timestampSec: t,
        signature: undefined,
        now,
      }),
    ).toBe(false);
  });
});
