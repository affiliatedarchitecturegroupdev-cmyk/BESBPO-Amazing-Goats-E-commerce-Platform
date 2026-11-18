import type { Db, FieldCipher } from '@ag/db';
import { currentSession, toIso, toIsoOrUndefined } from '@ag/db';
import { MfaEnrolment, MfaStore } from './mfa-domain';

interface MfaRow {
  subject_ref: string;
  secret_encrypted: string;
  confirmed_at: Date | string | null;
  created_at: Date | string;
}

const MFA_COLUMNS = 'subject_ref, secret_encrypted, confirmed_at, created_at';

/**
 * SQL adapter over `identity.mfa_enrolments`. The TOTP secret is stored
 * encrypted (field-level, `docs/02-access-control.md`), so it is decrypted on
 * read and encrypted on write through the injected `FieldCipher`; the row never
 * holds the plaintext. Row-level security scopes a subject to their own row and
 * lets staff read every row, so a non-staff session sees only its own factor.
 */
export class PgMfaStore implements MfaStore {
  constructor(
    private readonly db: Db,
    private readonly cipher: FieldCipher,
  ) {}

  private toEnrolment(row: MfaRow): MfaEnrolment {
    return {
      subjectId: row.subject_ref,
      secret: this.cipher.decrypt(row.secret_encrypted),
      enrolledAt: toIso(row.created_at),
      confirmedAt: toIsoOrUndefined(row.confirmed_at),
    };
  }

  async enrolment(subjectId: string): Promise<MfaEnrolment | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<MfaRow>(
        `SELECT ${MFA_COLUMNS} FROM identity.mfa_enrolments WHERE subject_ref = $1`,
        [subjectId],
      ),
    );
    return rows[0] ? this.toEnrolment(rows[0]) : undefined;
  }

  async save(enrolment: MfaEnrolment): Promise<void> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(
        `INSERT INTO identity.mfa_enrolments (subject_ref, secret_encrypted, confirmed_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (subject_ref) DO UPDATE SET
           secret_encrypted = EXCLUDED.secret_encrypted,
           confirmed_at = EXCLUDED.confirmed_at`,
        [enrolment.subjectId, this.cipher.encrypt(enrolment.secret), enrolment.confirmedAt ?? null],
      ),
    );
  }
}
