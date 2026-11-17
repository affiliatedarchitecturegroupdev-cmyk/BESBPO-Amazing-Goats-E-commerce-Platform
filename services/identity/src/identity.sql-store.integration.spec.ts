import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDb, runWithSession } from '@ag/db';
import { PgUsersStore } from './users/users.sql-store';
import { PgAccessStore } from './access/access.sql-store';
import type { User } from './users/users.types';
import type { ElevationRequest, RoleChange } from './access/access-domain';

/**
 * Integration test for the identity SQL adapters against a real Postgres. It
 * runs only when DATABASE_URL is set (the CI `db` job); otherwise it is skipped
 * so the default unit run needs no database.
 *
 * A superuser and a table owner BYPASS row-level security, so the test
 * provisions its own NOSUPERUSER, NOBYPASSRLS role — the shape `db/README.md`
 * requires of the application — and connects as it, then proves the adapters
 * read only the rows the session is allowed to see.
 */
const adminUrl = process.env.DATABASE_URL;
const admin = adminUrl ? new PgDb(adminUrl) : undefined;

const ROLE = 'ag_identity_it';
const PASSWORD = 'ag_identity_it';

const ORG_A = '1d000000-0000-0000-0000-0000000000a1';
const ORG_B = '1d000000-0000-0000-0000-0000000000b2';
const USER_A = '1d010000-0000-0000-0000-0000000000a1';
const USER_B = '1d010000-0000-0000-0000-0000000000b2';
const USER_REF_A = 'usr_it_a';
const USER_REF_B = 'usr_it_b';
const ORG_REF_A = 'org_it_a';
const ORG_REF_B = 'org_it_b';

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
  await admin!.query(`DELETE FROM identity.role_change_requests WHERE external_id LIKE 'rc_it_%'`);
  await admin!.query(`DELETE FROM identity.elevation_requests WHERE external_id LIKE 'el_it_%'`);
  await admin!.query(`DELETE FROM identity.user_roles WHERE user_id IN ('${USER_A}', '${USER_B}')`);
  await admin!.query(
    `DELETE FROM identity.org_members WHERE user_id IN ('${USER_A}', '${USER_B}')`,
  );
  await admin!.query(`DELETE FROM identity.users WHERE id IN ('${USER_A}', '${USER_B}')`);
  await admin!.query(`DELETE FROM identity.orgs WHERE id IN ('${ORG_A}', '${ORG_B}')`);
}

async function seedFixtures(): Promise<void> {
  await admin!.query(
    `INSERT INTO identity.orgs (id, kind, name, external_id)
       VALUES ('${ORG_A}', 'customer', 'IT Org A', '${ORG_REF_A}'),
              ('${ORG_B}', 'customer', 'IT Org B', '${ORG_REF_B}')`,
  );
  await admin!.query(
    `INSERT INTO identity.users (id, idp_subject, email, external_id, status)
       VALUES ('${USER_A}', 'it-id-a', 'id-a@example.co.za', '${USER_REF_A}', 'active'),
              ('${USER_B}', 'it-id-b', 'id-b@example.co.za', '${USER_REF_B}', 'active')`,
  );
  await admin!.query(
    `INSERT INTO identity.org_members (org_id, user_id, member_role)
       VALUES ('${ORG_A}', '${USER_A}', 'owner'), ('${ORG_B}', '${USER_B}', 'buyer')`,
  );
}

const user = (over: Partial<User> = {}): User => ({
  id: USER_REF_A,
  idpSubject: 'it-id-a',
  email: 'id-a@example.co.za',
  fullName: null,
  phone: null,
  mfaEnrolled: false,
  status: 'active',
  marketingOptIn: false,
  consentAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe.skipIf(!admin)('identity SQL adapters (integration)', () => {
  beforeAll(async () => {
    await cleanFixtures();
    await dropRole();
    await admin!.query(`CREATE ROLE ${ROLE} LOGIN PASSWORD '${PASSWORD}' NOSUPERUSER NOBYPASSRLS`);
    await admin!.query(
      `GRANT USAGE ON SCHEMA identity TO ${ROLE};
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA identity TO ${ROLE};
       GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA identity TO ${ROLE}`,
    );
    await seedFixtures();
    app = new PgDb(asRole(adminUrl!, ROLE, PASSWORD));
  });

  afterAll(async () => {
    if (!admin) return;
    await app?.end();
    await cleanFixtures();
    await dropRole();
    await admin.end();
  });

  describe('PgUsersStore', () => {
    it('round-trips a user and reads it back by id and email', async () => {
      const store = new PgUsersStore(app!);
      await runWithSession({ staff: true }, () =>
        store.save(user({ fullName: 'IT User A', marketingOptIn: true })),
      );
      const byId = await runWithSession({ staff: true }, () => store.get(USER_REF_A));
      expect(byId?.fullName).toBe('IT User A');
      expect(byId?.marketingOptIn).toBe(true);
      const byEmail = await runWithSession({ staff: true }, () =>
        store.byEmail('id-a@example.co.za'),
      );
      expect(byEmail?.id).toBe(USER_REF_A);
    });

    it('replaces a user roles and reads them back', async () => {
      const store = new PgUsersStore(app!);
      const grants = await runWithSession({ staff: true }, () =>
        store.setRoles(USER_REF_A, ['finance', 'sales'], 'admin_ref'),
      );
      expect(grants.map((g) => g.role).sort()).toEqual(['finance', 'sales']);
      const roles = await runWithSession({ staff: true }, () => store.rolesFor(USER_REF_A));
      expect(roles.sort()).toEqual(['finance', 'sales']);
    });

    it('scopes a customer to their own account, denying another user', async () => {
      const store = new PgUsersStore(app!);
      const own = await runWithSession({ userId: USER_A }, () => store.get(USER_REF_A));
      expect(own?.id).toBe(USER_REF_A);
      const other = await runWithSession({ userId: USER_A }, () => store.get(USER_REF_B));
      expect(other).toBeUndefined();
    });

    it('lists memberships for a user and members of an org', async () => {
      const store = new PgUsersStore(app!);
      // A staff session sees the whole membership picture.
      const mine = await runWithSession({ staff: true }, () => store.membershipsFor(USER_REF_A));
      expect(mine).toEqual([{ orgId: ORG_REF_A, userId: USER_REF_A, memberRole: 'owner' }]);
      const members = await runWithSession({ staff: true }, () => store.membersOf(ORG_REF_A));
      expect(members.map((m) => m.userId)).toEqual([USER_REF_A]);
    });

    it('lets a customer see only their own membership', async () => {
      const store = new PgUsersStore(app!);
      const mine = await runWithSession({ orgId: ORG_A, userId: USER_A }, () =>
        store.membershipsFor(USER_REF_A),
      );
      expect(mine.map((m) => m.userId)).toEqual([USER_REF_A]);
      // The other org's member is not visible to this customer.
      const other = await runWithSession({ orgId: ORG_A, userId: USER_A }, () =>
        store.membershipsFor(USER_REF_B),
      );
      expect(other).toEqual([]);
    });
  });

  describe('PgAccessStore', () => {
    it('round-trips a role change awaiting a second approver', async () => {
      const store = new PgAccessStore(app!);
      const change: RoleChange = {
        id: 'rc_it_1',
        subjectId: USER_REF_A,
        from: [],
        to: ['finance'],
        requestedBy: 'alice',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      await runWithSession({ staff: true }, () => store.saveRoleChange(change));
      const found = await runWithSession({ staff: true }, () => store.roleChange('rc_it_1'));
      expect(found?.to).toEqual(['finance']);
      expect(found?.approvedBy).toBeUndefined();

      const approved = await runWithSession({ staff: true }, () =>
        store.saveRoleChange({ ...change, approvedBy: 'bob' }),
      );
      expect(approved.approvedBy).toBe('bob');
    });

    it('applies a role set through setRoles and reads it back', async () => {
      const store = new PgAccessStore(app!);
      await runWithSession({ staff: true }, () => store.setRoles(USER_REF_A, ['finance', 'sales']));
      const roles = await runWithSession({ staff: true }, () => store.rolesFor(USER_REF_A));
      expect(roles.sort()).toEqual(['finance', 'sales']);
    });

    it('round-trips a break-glass elevation with its expiry', async () => {
      const store = new PgAccessStore(app!);
      const elevation: ElevationRequest = {
        id: 'el_it_1',
        subjectId: USER_REF_A,
        role: 'devops',
        reason: 'incident',
        requestedBy: 'alice',
        minutes: 60,
        createdAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-01-01T01:00:00.000Z',
      };
      await runWithSession({ staff: true }, () => store.saveElevation(elevation));
      const found = await runWithSession({ staff: true }, () => store.elevation('el_it_1'));
      expect(found?.role).toBe('devops');
      expect(found?.minutes).toBe(60);
      expect(found?.expiresAt).toBe('2026-01-01T01:00:00.000Z');
    });

    it('hides access records from a non-staff session', async () => {
      const store = new PgAccessStore(app!);
      const changes = await runWithSession({ userId: USER_A }, () => store.roleChanges());
      expect(changes).toEqual([]);
      const elevations = await runWithSession({ userId: USER_A }, () => store.elevations());
      expect(elevations).toEqual([]);
    });
  });
});
