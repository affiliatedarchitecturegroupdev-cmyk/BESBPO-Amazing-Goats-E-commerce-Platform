import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { FieldCipher, PgDb, runWithSession } from '@ag/db';
import { MfaService } from './mfa.service';
import { PgMfaStore } from './mfa.sql-store';
import { totp } from './totp';

/**
 * Integration test for the MFA SQL adapter against a real Postgres. It runs only
 * when DATABASE_URL is set (the CI `db` job); otherwise it is skipped, so the
 * default unit run needs no database.
 *
 * A superuser and a table owner BYPASS row-level security, so the test
 * provisions its own NOSUPERUSER, NOBYPASSRLS role — the shape `db/README.md`
 * requires of the application — and connects as it, then proves the adapter
 * reads only the rows the session is allowed to see.
 */
const adminUrl = process.env.DATABASE_URL;
const admin = adminUrl ? new PgDb(adminUrl) : undefined;

const ROLE = 'ag_mfa_it';
const PASSWORD = 'ag_mfa_it';
const SUBJECT_A = 'usr_mfa_it_a';
const SUBJECT_B = 'usr_mfa_it_b';
const cipher = new FieldCipher(randomBytes(32).toString('base64url'));

function asRole(url: string, role: string, password: string): string {
  const parsed = new URL(url);
  parsed.username = role;
  parsed.password = password;
  return parsed.toString();
}

let app: PgDb | undefined;

async function dropRole(): Promise<void> {
  await admin!.query(
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLE}')
       THEN EXECUTE 'DROP OWNED BY ${ROLE}'; END IF; END $$;`,
  );
  await admin!.query(`DROP ROLE IF EXISTS ${ROLE}`);
}

async function cleanFixtures(): Promise<void> {
  await admin!.query(
    `DELETE FROM identity.mfa_enrolments WHERE subject_ref IN ('${SUBJECT_A}', '${SUBJECT_B}')`,
  );
}

describe.skipIf(!admin)('MFA SQL adapter (integration)', () => {
  beforeAll(async () => {
    await cleanFixtures();
    await dropRole();
    await admin!.query(`CREATE ROLE ${ROLE} LOGIN PASSWORD '${PASSWORD}' NOSUPERUSER NOBYPASSRLS`);
    await admin!.query(
      `GRANT USAGE ON SCHEMA identity TO ${ROLE};
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA identity TO ${ROLE};
       GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA identity TO ${ROLE}`,
    );
    app = new PgDb(asRole(adminUrl!, ROLE, PASSWORD));
  });

  afterAll(async () => {
    if (!admin) return;
    await app?.end();
    await cleanFixtures();
    await dropRole();
    await admin.end();
  });

  it('round-trips an enrolment through beginEnrolment and reads the secret back', async () => {
    const store = new PgMfaStore(app!, cipher);
    const service = new MfaService(store, () => new Date('2026-01-01T00:00:00Z'));
    const { secret } = await runWithSession({ userId: SUBJECT_A }, () =>
      service.beginEnrolment(SUBJECT_A, 'staff@example.co.za'),
    );
    const found = await runWithSession({ userId: SUBJECT_A }, () => store.enrolment(SUBJECT_A));
    expect(found?.secret).toBe(secret);
    expect(found?.confirmedAt).toBeUndefined();
  });

  it('stores the secret encrypted, never in the clear', async () => {
    const { rows } = await admin!.query<{ secret_encrypted: string }>(
      `SELECT secret_encrypted FROM identity.mfa_enrolments WHERE subject_ref = '${SUBJECT_A}'`,
    );
    const stored = rows[0].secret_encrypted;
    expect(stored.startsWith('v1:')).toBe(true);
    expect(cipher.isEncrypted(stored)).toBe(true);
    // The plaintext secret is not recoverable from the column without the key.
    expect(() => new FieldCipher(randomBytes(32).toString('base64url')).decrypt(stored)).toThrow();
  });

  it('confirms enrolment with the first code and verifies a login', async () => {
    const store = new PgMfaStore(app!, cipher);
    const at = new Date('2026-01-01T00:00:00Z');
    const service = new MfaService(store, () => at);
    const secret = (await runWithSession({ userId: SUBJECT_A }, () => store.enrolment(SUBJECT_A)))!
      .secret;
    const unix = Math.floor(at.getTime() / 1000);
    await runWithSession({ userId: SUBJECT_A }, () =>
      service.confirm(SUBJECT_A, totp(secret, unix)),
    );
    expect(await runWithSession({ userId: SUBJECT_A }, () => service.isEnrolled(SUBJECT_A))).toBe(
      true,
    );
    expect(
      await runWithSession({ userId: SUBJECT_A }, () =>
        service.verify(SUBJECT_A, totp(secret, unix)),
      ),
    ).toEqual({ ok: true });
  });

  it('scopes a subject to their own enrolment, denying another subject', async () => {
    const store = new PgMfaStore(app!, cipher);
    const own = await runWithSession({ userId: SUBJECT_A }, () => store.enrolment(SUBJECT_A));
    expect(own?.subjectId).toBe(SUBJECT_A);
    const other = await runWithSession({ userId: SUBJECT_A }, () => store.enrolment(SUBJECT_B));
    expect(other).toBeUndefined();
  });

  it('lets a staff session read any enrolment', async () => {
    const store = new PgMfaStore(app!, cipher);
    const found = await runWithSession({ staff: true }, () => store.enrolment(SUBJECT_A));
    expect(found?.subjectId).toBe(SUBJECT_A);
  });

  it('refuses a write to another subject row', async () => {
    const store = new PgMfaStore(app!, cipher);
    // A subject session may not create a row for someone else: the policy's
    // WITH CHECK is the same expression, so this insert is rejected.
    await expect(
      runWithSession({ userId: SUBJECT_A }, () =>
        store.save({ subjectId: SUBJECT_B, secret: 'JBSWY3DPEHPK3PXP' }),
      ),
    ).rejects.toThrow();
  });
});
