import type { Db } from '@ag/db';
import { currentSession, toIso } from '@ag/db';
import { ConsentRecord, ConsentStore } from './consent';

interface ConsentRow {
  contact_ref: string;
  marketing: string[];
  consent_at: Date | string | null;
}

/**
 * SQL adapter over `notifications.consent`. Consent is stored per channel, so a
 * customer can allow email but not WhatsApp (docs/16-notifications.md); a single
 * `identity.users.marketing_opt_in` boolean cannot express that. The table is a
 * support-only record, so a non-staff session sees nothing (default deny).
 */
export class PgConsentStore implements ConsentStore {
  constructor(private readonly db: Db) {}

  async get(contactId: string): Promise<ConsentRecord | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ConsentRow>(
        `SELECT contact_ref, marketing, consent_at FROM notifications.consent WHERE contact_ref = $1`,
        [contactId],
      ),
    );
    if (!rows[0]) return undefined;
    return {
      contactId: rows[0].contact_ref,
      marketing: rows[0].marketing as ConsentRecord['marketing'],
      consentAt: rows[0].consent_at === null ? undefined : toIso(rows[0].consent_at),
    };
  }

  /** Record or replace a contact's channel opt-ins. */
  async set(record: ConsentRecord): Promise<void> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(
        `INSERT INTO notifications.consent (contact_ref, marketing, consent_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (contact_ref) DO UPDATE SET marketing = EXCLUDED.marketing,
           consent_at = EXCLUDED.consent_at`,
        [record.contactId, record.marketing, record.consentAt ?? null],
      ),
    );
  }
}
