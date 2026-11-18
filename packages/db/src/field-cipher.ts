import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Field-level encryption for personal data (`docs/02-access-control.md`). A
 * column the application must be able to read back — a TOTP secret, a bank
 * detail — is stored as `v1:<iv>:<tag>:<ciphertext>`, base64url, never in the
 * clear, so a database dump or a leaked backup does not disclose it.
 *
 * AES-256-GCM is authenticated: a tampered ciphertext fails to decrypt rather
 * than returning a wrong secret, so a bad row is caught at the boundary.
 */
export const ENCRYPTION_KEY_ENV = 'FIELD_ENCRYPTION_KEY';
const PREFIX = 'v1';

function keyFrom(secret: string): Buffer {
  // A 32-byte key may be given as 64 hex characters or 44 base64url/base64
  // characters (with or without padding); anything else is hashed to 32 bytes,
  // so a passphrase works too and the derived key is still full length.
  if (/^[0-9a-fA-F]{64}$/.test(secret)) return Buffer.from(secret, 'hex');
  const decoded = Buffer.from(secret, 'base64');
  if (decoded.length === 32) return decoded;
  return createHash('sha256').update(secret, 'utf8').digest();
}

/**
 * Encrypts and decrypts a single field. Construct one per process with the key
 * from `FIELD_ENCRYPTION_KEY`; `createFieldCipher` reads that variable and fails
 * when it is missing, so a service that must encrypt cannot boot without a key.
 */
export class FieldCipher {
  private readonly key: Buffer;

  constructor(key: string) {
    if (!key) throw new Error('a field encryption key is required');
    this.key = keyFrom(key);
  }

  /** Encrypts a plaintext field; empty stays empty (a null column, not a blob). */
  encrypt(plaintext: string): string {
    if (plaintext === '') return '';
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [PREFIX, b64(iv), b64(tag), b64(ciphertext)].join(':');
  }

  /** Decrypts a field written by `encrypt`; throws on tamper or a wrong key. */
  decrypt(stored: string): string {
    if (stored === '') return '';
    const [prefix, iv, tag, ciphertext] = stored.split(':');
    if (prefix !== PREFIX || !iv || !tag || !ciphertext) {
      throw new Error('field is not in the encrypted v1 format');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, unb64(iv));
    decipher.setAuthTag(unb64(tag));
    return Buffer.concat([decipher.update(unb64(ciphertext)), decipher.final()]).toString('utf8');
  }

  /** Whether a stored value is already encrypted (idempotent writes). */
  isEncrypted(stored: string): boolean {
    return stored.startsWith(`${PREFIX}:`);
  }
}

function b64(buf: Buffer): string {
  return buf.toString('base64url');
}

function unb64(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

/**
 * Builds a cipher from the environment. Throws when `FIELD_ENCRYPTION_KEY` is
 * unset so a service that stores an encrypted field fails at boot rather than
 * writing a plaintext secret.
 */
export function createFieldCipher(env: NodeJS.ProcessEnv = process.env): FieldCipher {
  const key = env[ENCRYPTION_KEY_ENV];
  if (!key) {
    throw new Error(`${ENCRYPTION_KEY_ENV} is required to encrypt personal-data fields`);
  }
  return new FieldCipher(key);
}
