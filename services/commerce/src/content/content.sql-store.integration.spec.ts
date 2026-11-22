import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDb, runWithSession } from '@ag/db';
import { ContentService } from './content.service';
import { PgContentStore } from './content.sql-store';
import type { ContentItem } from './content.store';

/**
 * Integration test for the content SQL adapter against a real Postgres, covering
 * the recipe detail added in migration 0024. It runs only when DATABASE_URL is
 * set (the CI `db` job); otherwise it is skipped, so the default unit run needs
 * no database.
 *
 * It connects as a NOSUPERUSER, NOBYPASSRLS role — a superuser bypasses RLS and
 * would make the visibility assertions meaningless — and proves the two promises
 * migrations 0023 and 0024 make: the public reads published recipes and their
 * detail only, and staff write and read everything.
 */
const adminUrl = process.env.DATABASE_URL;
const admin = adminUrl ? new PgDb(adminUrl) : undefined;

const ROLE = 'ag_content_it';
const PASSWORD = 'ag_content_it';

const LINE = 'CNTIT';
const SKU = 'IT-CNT-001';
const SLUG_PUBLISHED = 'it-published-recipe';
const SLUG_DRAFT = 'it-draft-recipe';

function asRole(url: string, role: string, password: string): string {
  const parsed = new URL(url);
  parsed.username = role;
  parsed.password = password;
  return parsed.toString();
}

let app: PgDb | undefined;
let variantId: string;

async function dropRole(): Promise<void> {
  await admin!.query(
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLE}')
       THEN EXECUTE 'DROP OWNED BY ${ROLE}'; END IF; END $$;`,
  );
  await admin!.query(`DROP ROLE IF EXISTS ${ROLE}`);
}

async function cleanFixtures(): Promise<void> {
  await admin!.query(`DELETE FROM catalog.content WHERE slug LIKE 'it-%-recipe'`);
  await admin!.query(`DELETE FROM catalog.variants WHERE sku LIKE 'IT-CNT-%'`);
  await admin!.query(`DELETE FROM catalog.products WHERE slug LIKE 'it-cnt%'`);
  await admin!.query(`DELETE FROM catalog.product_lines WHERE code = '${LINE}'`);
}

async function seedFixtures(): Promise<void> {
  await admin!.query(
    `INSERT INTO catalog.product_lines (code, name, grp, phase) VALUES ('${LINE}', 'IT content', 'test', 1)`,
  );
  await admin!.query(
    `INSERT INTO catalog.products (line_id, slug, name) VALUES
       ((SELECT id FROM catalog.product_lines WHERE code = '${LINE}'), 'it-cnt', 'IT content product')`,
  );
  const { rows } = await admin!.query<{ id: string }>(
    `INSERT INTO catalog.variants (product_id, sku, pack, unit, fulfilment, temperature, channel, phase, source_kind)
     VALUES ((SELECT id FROM catalog.products WHERE slug = 'it-cnt'), $1, '1 kg', 'kg', 'in_stock', 'ambient', 'both', 1, 'test')
     RETURNING id`,
    [SKU],
  );
  variantId = rows[0].id;
}

const at = new Date('2026-03-01T08:00:00Z');

const recipeDetail = {
  servings: 4,
  prepMinutes: 30,
  cookMinutes: 180,
  ingredients: [{ quantity: '1 kg', item: 'lamb neck', note: 'cut into pieces' }],
  steps: [{ text: 'Brown the meat.' }, { text: 'Simmer for three hours.' }],
};

/** A recipe authored through the real service, so the write path is exercised. */
async function author(
  service: ContentService,
  title: string,
  over: { publish?: boolean } = {},
): Promise<ContentItem> {
  const item = await service.create(
    {
      kind: 'recipe',
      title,
      summary: `${title} summary`,
      bodyMd: '## Notes\n\nCast iron.',
      taxonomy: ['lamb'],
      variantIds: [variantId],
      recipe: recipeDetail,
    },
    at,
  );
  if (over.publish) await service.publish(item.id, 'person', at);
  return item;
}

describe.skipIf(!admin)('content SQL adapter (integration)', () => {
  beforeAll(async () => {
    await cleanFixtures();
    await dropRole();
    await admin!.query(`CREATE ROLE ${ROLE} LOGIN PASSWORD '${PASSWORD}' NOSUPERUSER NOBYPASSRLS`);
    await admin!.query(
      `GRANT USAGE ON SCHEMA catalog TO ${ROLE};
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA catalog TO ${ROLE};
       GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA catalog TO ${ROLE}`,
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

  it('persists a recipe with its detail, links and rendered body', async () => {
    const service = new ContentService(new PgContentStore(app!));
    await runWithSession({ staff: true }, () => author(service, 'IT published recipe', { publish: true }));

    // The database also holds the seeded recipes, so assertions are scoped to
    // this test's fixture rather than to the total count.
    const list = await service.listPublishedRecipes();
    const mine = list.find((r) => r.slug === SLUG_PUBLISHED);
    expect(mine).toMatchObject({
      title: 'IT published recipe',
      servings: 4,
      timeLabel: '3 hr 30 min',
    });

    const recipe = await service.getPublishedRecipe('it-published-recipe');
    expect(recipe.ingredients).toEqual([
      { quantity: '1 kg', item: 'lamb neck', note: 'cut into pieces' },
    ]);
    expect(recipe.steps).toEqual([
      { text: 'Brown the meat.' },
      { text: 'Simmer for three hours.' },
    ]);
    expect(recipe.variantIds).toEqual([variantId]);
    expect(recipe.html).toContain('Cast iron.');
  });

  it('hides a draft recipe and its detail from a public read', async () => {
    const service = new ContentService(new PgContentStore(app!));
    await runWithSession({ staff: true }, () => author(service, 'IT draft recipe'));

    const list = await service.listPublishedRecipes();
    expect(list.map((r) => r.slug)).not.toContain('it-draft-recipe');

    const store = new PgContentStore(app!);
    const draft = await runWithSession({ staff: true }, () => store.getBySlug(SLUG_DRAFT));
    expect(draft).toBeDefined();

    // Public read: the row is invisible, so there is no detail to find either.
    const publicRead = await store.getBySlug(SLUG_DRAFT);
    expect(publicRead).toBeUndefined();
    expect(await store.recipeDetail(draft!.id)).toBeUndefined();
  });

  it('replaces the detail and links when a draft is patched', async () => {
    const service = new ContentService(new PgContentStore(app!));
    const item = await runWithSession({ staff: true }, () => author(service, 'IT patchable recipe'));

    await runWithSession({ staff: true }, () =>
      service.patch(
        item.id,
        {
          variantIds: [],
          recipe: { ...recipeDetail, servings: 8, steps: [{ text: 'Feed a crowd.' }] },
        },
        at,
      ),
    );
    await runWithSession({ staff: true }, () => service.publish(item.id, 'person', at));

    const recipe = await service.getPublishedRecipe('it-patchable-recipe');
    expect(recipe.servings).toBe(8);
    expect(recipe.steps).toEqual([{ text: 'Feed a crowd.' }]);
    expect(recipe.variantIds).toEqual([]);
  });

  it('reads details for a page of recipes in one query', async () => {
    const store = new PgContentStore(app!);
    const ids = await runWithSession({ staff: true }, async () => {
      const rows = await store.list({ kind: 'recipe', status: 'published' });
      return rows.map((r) => r.id);
    });
    const details = await runWithSession({ staff: true }, () => store.recipeDetails(ids));
    expect(details.size).toBe(ids.length);
    for (const detail of details.values()) expect(detail.steps.length).toBeGreaterThan(0);
  });

  it('refuses a public write', async () => {
    const store = new PgContentStore(app!);
    await expect(
      store.create({
        id: '99999999-9999-4999-8999-999999999999',
        kind: 'recipe',
        slug: 'it-sneaky-recipe',
        title: 'Sneaky',
        bodyMd: '',
        status: 'published',
        taxonomy: [],
        variantIds: [],
        createdAt: at.toISOString(),
        updatedAt: at.toISOString(),
      }),
    ).rejects.toThrow();
  });
});
