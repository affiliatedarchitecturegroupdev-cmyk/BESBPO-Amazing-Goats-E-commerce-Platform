import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDb, runWithSession } from '@ag/db';
import { PgCampaignsStore } from './campaigns/campaigns.sql-store';
import { PgCreativesStore } from './creatives/creatives.sql-store';
import { PgBillingStore } from './billing/billing.sql-store';
import { PgReportingStore } from './reporting/reporting.sql-store';
import { PgFrequencyStore } from './decisioning/frequency.sql-store';
import type { Campaign } from './campaigns/campaign-rules';

/**
 * Integration test for the ads SQL adapters against a real Postgres. It runs
 * only when DATABASE_URL is set (the CI `db` job); otherwise it is skipped so
 * the default unit run needs no database.
 *
 * A superuser and a table owner BYPASS row-level security, so the test
 * provisions its own NOSUPERUSER, NOBYPASSRLS role — the shape db/README.md
 * requires of the application — and connects as it, then proves an advertiser
 * sees only their own campaigns and ledger while a staff session sees all.
 */
const adminUrl = process.env.DATABASE_URL;
const admin = adminUrl ? new PgDb(adminUrl) : undefined;

const ROLE = 'ag_ads_it';
const PASSWORD = 'ag_ads_it';

const ORG_A = 'ad000000-0000-0000-0000-0000000000a1';
const ORG_B = 'ad000000-0000-0000-0000-0000000000b2';
const ORG_REF_A = 'org_ads_it_a';
const ORG_REF_B = 'org_ads_it_b';
const CAMPAIGN_A = 'ad100000-0000-0000-0000-0000000000a1';
const CAMPAIGN_B = 'ad100000-0000-0000-0000-0000000000b2';
const CREATIVE_A = 'ad200000-0000-0000-0000-0000000000a1';

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
  await admin!.query(`DELETE FROM ads.impressions WHERE user_hash = 'it-hash'`);
  await admin!.query(`DELETE FROM ads.clicks WHERE user_hash = 'it-hash'`);
  await admin!.query(`DELETE FROM ads.wallet_ledger WHERE advertiser_org_ref IN ('${ORG_REF_A}', '${ORG_REF_B}')`);
  await admin!.query(`DELETE FROM ads.creatives WHERE id = '${CREATIVE_A}'`);
  await admin!.query(`DELETE FROM ads.campaigns WHERE id IN ('${CAMPAIGN_A}', '${CAMPAIGN_B}')`);
  await admin!.query(`DELETE FROM identity.orgs WHERE id IN ('${ORG_A}', '${ORG_B}')`);
}

async function seedFixtures(): Promise<void> {
  await admin!.query(
    `INSERT INTO identity.orgs (id, kind, name, external_id)
       VALUES ('${ORG_A}', 'advertiser', 'IT Advertiser A', '${ORG_REF_A}'),
              ('${ORG_B}', 'advertiser', 'IT Advertiser B', '${ORG_REF_B}')`,
  );
  await admin!.query(
    `INSERT INTO ads.campaigns (id, advertiser_org_id, advertiser_org_ref, name, budget_cents, pricing)
       VALUES ('${CAMPAIGN_A}', '${ORG_A}', '${ORG_REF_A}', 'IT Campaign A', 100000, 'flat'),
              ('${CAMPAIGN_B}', '${ORG_B}', '${ORG_REF_B}', 'IT Campaign B', 200000, 'flat')`,
  );
}

const campaign = (over: Partial<Campaign> = {}): Campaign => ({
  id: CAMPAIGN_A,
  advertiserOrgId: ORG_REF_A,
  name: 'IT Campaign A',
  goal: 'Awareness',
  budgetCents: 100_000,
  spentCents: 0,
  pricing: 'flat',
  status: 'draft',
  targeting: {},
  ...over,
});

describe.skipIf(!admin)('ads SQL adapters (integration)', () => {
  beforeAll(async () => {
    await cleanFixtures();
    await dropRole();
    await admin!.query(`CREATE ROLE ${ROLE} LOGIN PASSWORD '${PASSWORD}' NOSUPERUSER NOBYPASSRLS`);
    await admin!.query(
      `GRANT USAGE ON SCHEMA ads, identity TO ${ROLE};
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ads, identity TO ${ROLE};
       GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ads, identity TO ${ROLE}`,
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

  describe('PgCampaignsStore', () => {
    it('round-trips a campaign and reads it back by id', async () => {
      const store = new PgCampaignsStore(app!);
      const updated = campaign({ status: 'pending_review', submittedAt: '2026-11-14T10:00:00.000Z' });
      await runWithSession({ staff: true }, () => store.replace(updated));
      const found = await runWithSession({ staff: true }, () => store.get(CAMPAIGN_A));
      expect(found?.name).toBe('IT Campaign A');
      expect(found?.status).toBe('pending_review');
      expect(found?.advertiserOrgId).toBe(ORG_REF_A);
      expect(found?.submittedAt).toBe('2026-11-14T10:00:00.000Z');
    });

    it('inserts a campaign resolving the advertiser organisation', async () => {
      const store = new PgCampaignsStore(app!);
      const id = 'ad100000-0000-0000-0000-0000000000c3';
      await runWithSession({ staff: true }, () =>
        store.insert(campaign({ id, name: 'IT Campaign C', advertiserOrgId: ORG_REF_B })),
      );
      const found = await runWithSession({ staff: true }, () => store.get(id));
      expect(found?.advertiserOrgId).toBe(ORG_REF_B);
      await admin!.query(`DELETE FROM ads.campaigns WHERE id = '${id}'`);
    });

    it('scopes a campaign to its advertiser and denies another org', async () => {
      const store = new PgCampaignsStore(app!);
      const own = await runWithSession({ orgId: ORG_REF_A }, () => store.get(CAMPAIGN_A));
      expect(own?.id).toBe(CAMPAIGN_A);
      const other = await runWithSession({ orgId: ORG_REF_A }, () => store.get(CAMPAIGN_B));
      expect(other).toBeUndefined();
    });

    it('hides every campaign from a default-deny session', async () => {
      const store = new PgCampaignsStore(app!);
      expect(await store.all()).toEqual([]);
    });
  });

  describe('PgCreativesStore', () => {
    it('round-trips a creative and reads it by campaign', async () => {
      const store = new PgCreativesStore(app!);
      await runWithSession({ staff: true }, () =>
        store.insert({
          id: CREATIVE_A,
          campaignId: CAMPAIGN_A,
          slotCode: 'A4',
          assetUrl: 'https://cdn/a.png',
          reviewStatus: 'pending',
        }),
      );
      const byCampaign = await runWithSession({ staff: true }, () =>
        store.byCampaign(CAMPAIGN_A),
      );
      expect(byCampaign.map((c) => c.id)).toEqual([CREATIVE_A]);

      await runWithSession({ staff: true }, () =>
        store.replace({ ...byCampaign[0], reviewStatus: 'approved', reviewedBy: 'reviewer-1' }),
      );
      const found = await runWithSession({ staff: true }, () => store.get(CREATIVE_A));
      expect(found?.reviewStatus).toBe('approved');
      expect(found?.reviewedBy).toBe('reviewer-1');
    });

    it('hides a creative from an org that does not own its campaign', async () => {
      const store = new PgCreativesStore(app!);
      const own = await runWithSession({ orgId: ORG_REF_A }, () => store.get(CREATIVE_A));
      expect(own?.id).toBe(CREATIVE_A);
      const other = await runWithSession({ orgId: ORG_REF_B }, () => store.get(CREATIVE_A));
      expect(other).toBeUndefined();
    });
  });

  describe('PgBillingStore', () => {
    it('appends signed movements and reads them oldest first', async () => {
      const store = new PgBillingStore(app!);
      await runWithSession({ staff: true }, () =>
        store.append({
          advertiserOrgId: ORG_REF_A,
          kind: 'top_up',
          amountCents: 50_000,
          at: '2026-11-14T10:00:00.000Z',
        }),
      );
      await runWithSession({ staff: true }, () =>
        store.append({
          advertiserOrgId: ORG_REF_A,
          kind: 'spend',
          amountCents: -12_000,
          at: '2026-11-14T11:00:00.000Z',
        }),
      );
      const ledger = await runWithSession({ staff: true }, () => store.ledger(ORG_REF_A));
      expect(ledger.map((e) => e.amountCents)).toEqual([50_000, -12_000]);
      expect(ledger.every((e) => e.advertiserOrgId === ORG_REF_A)).toBe(true);
    });

    it('hides another advertiser’s ledger from a non-staff session', async () => {
      const store = new PgBillingStore(app!);
      const ledger = await runWithSession({ orgId: ORG_REF_B }, () => store.ledger(ORG_REF_A));
      expect(ledger).toEqual([]);
    });
  });

  describe('PgReportingStore and PgFrequencyStore', () => {
    it('records impressions and clicks, then reads them for the rollup', async () => {
      const frequency = new PgFrequencyStore(app!);
      await runWithSession({ staff: true }, async () => {
        await frequency.recordImpression('it-hash', CREATIVE_A, 'A4');
        await frequency.recordImpression('it-hash', CREATIVE_A, 'A4');
        await frequency.recordClick('it-hash', CREATIVE_A);
        expect(await frequency.impressionsFor('it-hash', CREATIVE_A)).toBe(2);
      });

      const reporting = new PgReportingStore(app!);
      const impressions = await runWithSession({ staff: true }, () => reporting.impressions());
      const clicks = await runWithSession({ staff: true }, () => reporting.clicks());
      expect(impressions.filter((r) => r.creativeId === CREATIVE_A)).toHaveLength(2);
      expect(clicks.filter((r) => r.creativeId === CREATIVE_A)).toHaveLength(1);
    });
  });
});
