import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { FieldCipher, createFieldCipher, ENCRYPTION_KEY_ENV } from './field-cipher';

const key = randomBytes(32).toString('base64url');

describe('FieldCipher', () => {
  it('round-trips a plaintext field', () => {
    const cipher = new FieldCipher(key);
    const stored = cipher.encrypt('JBSWY3DPEHPK3PXP');
    expect(stored).not.toContain('JBSWY3DPEHPK3PXP');
    expect(stored.startsWith('v1:')).toBe(true);
    expect(cipher.decrypt(stored)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const cipher = new FieldCipher(key);
    expect(cipher.encrypt('same')).not.toBe(cipher.encrypt('same'));
  });

  it('keeps an empty field empty rather than writing a blob', () => {
    const cipher = new FieldCipher(key);
    expect(cipher.encrypt('')).toBe('');
    expect(cipher.decrypt('')).toBe('');
  });

  it('accepts a 64-hex key and a passphrase alike', () => {
    const hex = randomBytes(32).toString('hex');
    expect(new FieldCipher(hex).decrypt(new FieldCipher(hex).encrypt('x'))).toBe('x');
    const phrase = new FieldCipher('a human passphrase');
    expect(phrase.decrypt(phrase.encrypt('x'))).toBe('x');
  });

  it('fails to decrypt a tampered ciphertext rather than returning a wrong value', () => {
    const cipher = new FieldCipher(key);
    const stored = cipher.encrypt('secret');
    const [prefix, iv, tag, body] = stored.split(':');
    const flipped = Buffer.from(body, 'base64url');
    flipped[0] ^= 0xff;
    const tampered = [prefix, iv, tag, flipped.toString('base64url')].join(':');
    expect(() => cipher.decrypt(tampered)).toThrow();
  });

  it('fails to decrypt with the wrong key', () => {
    const stored = new FieldCipher(key).encrypt('secret');
    expect(() => new FieldCipher(randomBytes(32).toString('base64url')).decrypt(stored)).toThrow();
  });

  it('rejects a value that is not in the encrypted format', () => {
    expect(() => new FieldCipher(key).decrypt('plaintext')).toThrow(/encrypted v1 format/);
  });

  it('reports whether a stored value is already encrypted', () => {
    const cipher = new FieldCipher(key);
    expect(cipher.isEncrypted(cipher.encrypt('x'))).toBe(true);
    expect(cipher.isEncrypted('JBSWY3DPEHPK3PXP')).toBe(false);
  });

  it('createFieldCipher reads FIELD_ENCRYPTION_KEY and fails when it is unset', () => {
    expect(() => createFieldCipher({})).toThrow(new RegExp(ENCRYPTION_KEY_ENV));
    const cipher = createFieldCipher({ [ENCRYPTION_KEY_ENV]: key });
    expect(cipher.decrypt(cipher.encrypt('x'))).toBe('x');
  });
});
