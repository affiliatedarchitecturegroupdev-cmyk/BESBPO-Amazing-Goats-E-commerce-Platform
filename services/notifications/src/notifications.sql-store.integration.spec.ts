import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDb, runWithSession } from '@ag/db';
import { PgConsentStore } from './consent/consent.sql-store';
import { PgDispatchLog } from './dispatch/dispatch.sql-store';
import { decideConsent } from './consent/consent';
import type { DispatchRecord } from './dispatch/dispatch';

/**
 * Integration test for the notifications SQL adapters against a real Postgres.
 * It runs only when DATABASE_URL is set (the CI `db` job); otherwise it is
 * skipped so the default unit run needs no database.
 *
 * A superuser and a table owner BYPASS row-level security, so the test
 * provisions its own NOSUPERUSER, NOBYPASSRLS role — the shape db/README.md
 * requires of the application — and connects as it. The dispatch log and
 * consent are support-only records, so only a staff session sees them; the test
 * proves a non-staff session sees nothing.
 */
const adminUrl = process.env.DATABASE_URL;
const admin = adminUrl ? new PgDb(adminUrl) : undefined;

const ROLE = 'ag_notifications_it';
const PASSWORD = 'ag_notifications_it';

const CONTACT = 'contact_it_1';

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
  await admin!.query(`DELETE FROM notifications.messages WHERE contact_ref = '${CONTACT}'`);
  await admin!.query(`DELETE FROM notifications.consent WHERE contact_ref = '${CONTACT}'`);
}

const record = (over: Partial<DispatchRecord> = {}): DispatchRecord => ({
  id: 'msg_it_1',
  channel: 'email',
  templateKey: 'order_confirmation',
  contactId: CONTACT,
  status: 'sent',
  reason: 'transactional',
  at: '2026-11-14T10:00:00.000Z',
  ...over,
});

describe.skipIf(!admin)('notifications SQL adapters (integration)', () => {
  beforeAll(async () => {
    await cleanFixtures();
    await dropRole();
    await admin!.query(`CREATE ROLE ${ROLE} LOGIN PASSWORD '${PASSWORD}' NOSUPERUSER NOBYPASSRLS`);
    await admin!.query(
      `GRANT USAGE ON SCHEMA notifications TO ${ROLE};
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA notifications TO ${ROLE};
       GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA notifications TO ${ROLE}`,
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

  describe('PgDispatchLog', () => {
    it('records an outcome with its reason and lists it', async () => {
      const log = new PgDispatchLog(app!);
      await runWithSession({ staff: true }, () => log.record(record()));
      const listed = await runWithSession({ staff: true }, () => log.list());
      const found = listed.find((entry) => entry.id === 'msg_it_1');
      expect(found?.status).toBe('sent');
      expect(found?.reason).toBe('transactional');
      expect(found?.channel).toBe('email');
    });

    it('records a suppressed outcome and its reason', async () => {
      const log = new PgDispatchLog(app!);
      await runWithSession({ staff: true }, () =>
        log.record(record({ id: 'msg_it_2', status: 'suppressed', reason: 'no_consent' })),
      );
      const listed = await runWithSession({ staff: true }, () => log.list());
      const found = listed.find((entry) => entry.id === 'msg_it_2');
      expect(found?.status).toBe('suppressed');
      expect(found?.reason).toBe('no_consent');
    });

    it('hides the dispatch log from a non-staff session', async () => {
      const log = new PgDispatchLog(app!);
      expect(await runWithSession({ userId: 'someone' }, () => log.list())).toEqual([]);
    });
  });

  describe('PgConsentStore', () => {
    it('round-trips per-channel opt-ins and reads them back', async () => {
      const store = new PgConsentStore(app!);
      await runWithSession({ staff: true }, () =>
        store.set({ contactId: CONTACT, marketing: ['email'], consentAt: '2026-11-01T00:00:00.000Z' }),
      );
      const found = await runWithSession({ staff: true }, () => store.get(CONTACT));
      expect(found?.marketing).toEqual(['email']);
      expect(found?.consentAt).toBe('2026-11-01T00:00:00.000Z');
    });

    it('drives decideConsent: opt-in on one channel, not another', async () => {
      const store = new PgConsentStore(app!);
      const email = await runWithSession({ staff: true }, () =>
        decideConsent(store, { contactId: CONTACT, channel: 'email', kind: 'marketing' }),
      );
      expect(email).toEqual({ allowed: true, reason: 'opted_in' });
      const whatsapp = await runWithSession({ staff: true }, () =>
        decideConsent(store, { contactId: CONTACT, channel: 'whatsapp', kind: 'marketing' }),
      );
      expect(whatsapp).toEqual({ allowed: false, reason: 'no_consent' });
    });

    it('never sends marketing to an unknown contact', async () => {
      const store = new PgConsentStore(app!);
      const decision = await runWithSession({ staff: true }, () =>
        decideConsent(store, { contactId: 'nobody_it', channel: 'email', kind: 'marketing' }),
      );
      expect(decision).toEqual({ allowed: false, reason: 'unknown_contact' });
    });

    it('hides consent from a non-staff session', async () => {
      const store = new PgConsentStore(app!);
      expect(await runWithSession({ userId: 'someone' }, () => store.get(CONTACT))).toBeUndefined();
    });
  });
});
