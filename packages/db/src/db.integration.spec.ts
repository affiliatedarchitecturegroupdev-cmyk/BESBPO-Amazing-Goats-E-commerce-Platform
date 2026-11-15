import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDb } from './db';
import { runWithSession, currentSession } from './session-context';

/**
 * Integration test against a real Postgres. It runs only when DATABASE_URL is
 * set (the CI `db` job and `make db-reset` set it); otherwise it is skipped so
 * the default unit run needs no database.
 *
 * DATABASE_URL may be a superuser (CI's `db` job connects as one). A superuser
 * and a table owner BYPASS row-level security, so asserting scoping through that
 * connection would prove nothing. The test therefore provisions its own
 * NOSUPERUSER, NOBYPASSRLS role — the same shape `db/tests/rls.sql` uses and
 * `db/README.md` requires of the application — and connects as it for the RLS
 * assertions. The throwaway table means it does not depend on seed data.
 */
const adminUrl = process.env.DATABASE_URL;
const admin = adminUrl ? new PgDb(adminUrl) : undefined;

const ROLE = 'ag_db_adapter_test';
const ROLE_PASSWORD = 'ag_db_adapter_test';
const TABLE = 'public.ag_db_adapter_test';

/** Builds an application connection string by swapping the credentials. */
function asRole(url: string, role: string, password: string): string {
  const parsed = new URL(url);
  parsed.username = role;
  parsed.password = password;
  return parsed.toString();
}

let app: PgDb | undefined;

describe.skipIf(!admin)('PgDb.withSession (integration)', () => {
  beforeAll(async () => {
    await admin!.query(`DROP TABLE IF EXISTS ${TABLE}`);
    await admin!.query(`DROP ROLE IF EXISTS ${ROLE}`);
    await admin!.query(
      `CREATE ROLE ${ROLE} LOGIN PASSWORD '${ROLE_PASSWORD}' NOSUPERUSER NOBYPASSRLS`,
    );
    await admin!.query(
      `CREATE TABLE ${TABLE} (id text PRIMARY KEY, org_id text NOT NULL);
       ALTER TABLE ${TABLE} ENABLE ROW LEVEL SECURITY;
       CREATE POLICY owner ON ${TABLE}
         USING (current_setting('app.staff', true) = 'on'
                OR org_id = current_setting('app.org_id', true));`,
    );
    await admin!.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${TABLE} TO ${ROLE}`);
    await admin!.query(`INSERT INTO ${TABLE} (id, org_id) VALUES ('a', 'org-1'), ('b', 'org-2')`);
    app = new PgDb(asRole(adminUrl!, ROLE, ROLE_PASSWORD));
  });

  afterAll(async () => {
    if (!admin) return;
    await app?.end();
    await admin.query(`DROP TABLE IF EXISTS ${TABLE}`);
    await admin.query(`DROP ROLE IF EXISTS ${ROLE}`);
    await admin.end();
  });

  it('sees only the rows the session org owns', async () => {
    const rows = await app!.withSession({ orgId: 'org-1' }, (tx) =>
      tx.query(`SELECT id FROM ${TABLE} ORDER BY id`),
    );
    expect(rows.rows.map((r) => r.id)).toEqual(['a']);
  });

  it('sees everything for a staff session', async () => {
    const rows = await app!.withSession({ staff: true }, (tx) =>
      tx.query(`SELECT id FROM ${TABLE} ORDER BY id`),
    );
    expect(rows.rows.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('is default-deny with an empty session', async () => {
    const rows = await app!.withSession({}, (tx) => tx.query(`SELECT id FROM ${TABLE}`));
    expect(rows.rows).toEqual([]);
  });

  it('rolls the transaction back when the callback throws', async () => {
    await expect(
      app!.withSession({ staff: true }, async (tx) => {
        await tx.query(`INSERT INTO ${TABLE} (id, org_id) VALUES ('c', 'org-1')`);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const rows = await app!.withSession({ staff: true }, (tx) =>
      tx.query(`SELECT id FROM ${TABLE} WHERE id = 'c'`),
    );
    expect(rows.rows).toEqual([]);
  });

  it('reads the ambient session set by runWithSession', async () => {
    const seen = await runWithSession({ orgId: 'org-2' }, async () => {
      const rows = await app!.withSession(currentSession(), (tx) =>
        tx.query(`SELECT id FROM ${TABLE} ORDER BY id`),
      );
      return rows.rows.map((r) => r.id);
    });
    expect(seen).toEqual(['b']);
  });
});
