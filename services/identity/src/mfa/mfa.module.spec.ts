import { describe, it, expect, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { FieldCipher } from '@ag/db';
import { mfaStore } from './mfa.module';
import { InMemoryMfaStore } from './mfa-domain';
import { PgMfaStore } from './mfa.sql-store';

const cipher = new FieldCipher(randomBytes(32).toString('base64url'));

describe('mfaStore', () => {
  const original = process.env.STORE_DRIVER;
  afterEach(() => {
    if (original === undefined) delete process.env.STORE_DRIVER;
    else process.env.STORE_DRIVER = original;
  });

  it('is in-memory by default, so existing tests and local runs need no database', () => {
    delete process.env.STORE_DRIVER;
    expect(mfaStore()).toBeInstanceOf(InMemoryMfaStore);
  });

  it('is the SQL adapter when STORE_DRIVER=sql', () => {
    process.env.STORE_DRIVER = 'sql';
    expect(mfaStore({} as never, cipher)).toBeInstanceOf(PgMfaStore);
  });
});
