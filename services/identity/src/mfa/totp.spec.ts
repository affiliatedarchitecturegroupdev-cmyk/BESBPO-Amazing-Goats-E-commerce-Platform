import { describe, it, expect } from 'vitest';
import {
  base32Decode,
  base32Encode,
  counterFor,
  generateTotpSecret,
  hotp,
  otpauthUri,
  totp,
  verifyTotp,
} from './totp';

// RFC 6238 Appendix B uses the ASCII secret "12345678901234567890".
const RFC_SECRET_ASCII = '12345678901234567890';
const RFC_SECRET_B32 = base32Encode(Buffer.from(RFC_SECRET_ASCII));

describe('base32', () => {
  it('round-trips bytes', () => {
    const buf = Buffer.from(RFC_SECRET_ASCII);
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });

  it('rejects an invalid character', () => {
    expect(() => base32Decode('0189')).toThrow(/invalid base32/);
  });
});

describe('counterFor', () => {
  it('steps once per 30 seconds', () => {
    expect(counterFor(0)).toBe(0);
    expect(counterFor(29)).toBe(0);
    expect(counterFor(30)).toBe(1);
    expect(counterFor(59)).toBe(1);
  });
});

describe('TOTP matches the RFC 6238 test vector', () => {
  // Time, expected 8-digit code (we compare the last 6 digits).
  const vectors: [number, string][] = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ];
  it.each(vectors)('at %i the code ends %s', (unixSeconds, expected8) => {
    const expected6 = expected8.slice(-6);
    expect(hotp(Buffer.from(RFC_SECRET_ASCII), counterFor(unixSeconds), 8)).toBe(expected8);
    expect(totp(RFC_SECRET_B32, unixSeconds)).toBe(expected6);
  });
});

describe('generateTotpSecret', () => {
  it('produces a base32 secret that decodes to 20 bytes', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(base32Decode(secret)).toHaveLength(20);
  });
});

describe('verifyTotp', () => {
  const secret = generateTotpSecret();
  const at = 1_700_000_000;

  it('accepts the current code', () => {
    expect(verifyTotp(secret, totp(secret, at), at)).toBe(true);
  });

  it('accepts a code one step either side (clock drift)', () => {
    expect(verifyTotp(secret, totp(secret, at - 30), at)).toBe(true);
    expect(verifyTotp(secret, totp(secret, at + 30), at)).toBe(true);
  });

  it('rejects a code two steps away', () => {
    expect(verifyTotp(secret, totp(secret, at + 60), at)).toBe(false);
  });

  it('rejects the wrong code and malformed input', () => {
    expect(verifyTotp(secret, '000000', at)).toBe(false);
    expect(verifyTotp(secret, 'abcdef', at)).toBe(false);
    expect(verifyTotp(secret, '12345', at)).toBe(false);
  });
});

describe('otpauthUri', () => {
  it('builds a scannable URI with issuer and account', () => {
    const uri = otpauthUri('ABCDEF', 'staff@example.co.za', 'Amazing Goats');
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('secret=ABCDEF');
    expect(uri).toContain('issuer=Amazing+Goats');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });
});
