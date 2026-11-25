import type { Db } from '@ag/db';
import { currentSession, toIsoOrUndefined } from '@ag/db';
import type { ContentItem, ContentListQuery, ContentStore } from './content.store';
import { parseRecipeDetail, type RecipeDetail } from './recipe.rules';

interface ContentRow {
  id: string;
  kind: ContentItem['kind'];
  slug: string;
  title: string;
  summary: string | null;
  body_md: string;
  author_user_id: string | null;
  status: ContentItem['status'];
  published_at: Date | string | null;
  hero_image_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  taxonomy: string[] | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface RecipeRow {
  content_id: string;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  ingredients: unknown;
  steps: unknown;
}

const COLUMNS = `id, kind, slug, title, summary, body_md, author_user_id, status,
  published_at, hero_image_url, seo_title, seo_description, taxonomy, created_at, updated_at`;

/**
 * SQL adapter over `catalog.content`, `catalog.content_products` and
 * `catalog.content_recipes` (migrations 0023 and 0024). Every read runs in the
 * request's RLS session, so a public reader sees published rows only and the
 * policy — not this class — is what keeps a draft off the storefront.
 *
 * Product links live in their own table, so `variantIds` is assembled from the
 * join rather than stored on the row: a variant can then be deleted without
 * leaving a dangling id in an array.
 *
 * `variantIds` holds SKUs, not `catalog.variants.id` UUIDs. The SKU is the
 * catalogue's domain key (`CatalogueItem.id`, see `catalog.sql-store.ts`), so a
 * recipe's links resolve against the same ids the storefront renders products
 * with. Exposing UUIDs here would make every "shop this recipe" row match
 * nothing, silently.
 */
export class PgContentStore implements ContentStore {
  constructor(private readonly db: Db) {}

  private toItem(row: ContentRow, variantIds: string[]): ContentItem {
    return {
      id: row.id,
      kind: row.kind,
      slug: row.slug,
      title: row.title,
      summary: row.summary ?? undefined,
      bodyMd: row.body_md,
      authorUserId: row.author_user_id ?? undefined,
      status: row.status,
      publishedAt: toIsoOrUndefined(row.published_at),
      heroImageUrl: row.hero_image_url ?? undefined,
      seoTitle: row.seo_title ?? undefined,
      seoDescription: row.seo_description ?? undefined,
      taxonomy: row.taxonomy ?? [],
      variantIds,
      createdAt: toIsoOrUndefined(row.created_at) ?? '',
      updatedAt: toIsoOrUndefined(row.updated_at) ?? '',
    };
  }

  /** The linked SKUs for a set of content rows, in one query. */
  private async variantsFor(ids: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    if (ids.length === 0) return out;
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<{ content_id: string; sku: string }>(
        `SELECT cp.content_id, v.sku
           FROM catalog.content_products cp
           JOIN catalog.variants v ON v.id = cp.variant_id
          WHERE cp.content_id = ANY($1::uuid[])`,
        [ids],
      ),
    );
    for (const row of rows) {
      const list = out.get(row.content_id) ?? [];
      list.push(row.sku);
      out.set(row.content_id, list);
    }
    return out;
  }

  private async hydrate(rows: ContentRow[]): Promise<ContentItem[]> {
    const links = await this.variantsFor(rows.map((r) => r.id));
    return rows.map((r) => this.toItem(r, links.get(r.id) ?? []));
  }

  async create(item: ContentItem): Promise<ContentItem> {
    await this.db.withSession(currentSession(), async (tx) => {
      await tx.query(
        `INSERT INTO catalog.content
           (id, kind, slug, title, summary, body_md, author_user_id, status,
            published_at, hero_image_url, seo_title, seo_description, taxonomy,
            created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          item.id,
          item.kind,
          item.slug,
          item.title,
          item.summary ?? null,
          item.bodyMd,
          item.authorUserId ?? null,
          item.status,
          item.publishedAt ?? null,
          item.heroImageUrl ?? null,
          item.seoTitle ?? null,
          item.seoDescription ?? null,
          item.taxonomy,
          item.createdAt,
          item.updatedAt,
        ],
      );
      await this.replaceVariants(tx, item.id, item.variantIds);
    });
    return item;
  }

  async get(id: string): Promise<ContentItem | undefined> {
    const rows = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ContentRow>(`SELECT ${COLUMNS} FROM catalog.content WHERE id = $1`, [id]),
    );
    if (!rows.rows[0]) return undefined;
    return (await this.hydrate(rows.rows))[0];
  }

  async getBySlug(slug: string): Promise<ContentItem | undefined> {
    const rows = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ContentRow>(`SELECT ${COLUMNS} FROM catalog.content WHERE slug = $1`, [slug]),
    );
    if (!rows.rows[0]) return undefined;
    return (await this.hydrate(rows.rows))[0];
  }

  async update(item: ContentItem): Promise<ContentItem> {
    await this.db.withSession(currentSession(), async (tx) => {
      await tx.query(
        `UPDATE catalog.content SET
           kind = $2, slug = $3, title = $4, summary = $5, body_md = $6,
           author_user_id = $7, status = $8, published_at = $9, hero_image_url = $10,
           seo_title = $11, seo_description = $12, taxonomy = $13, updated_at = $14
         WHERE id = $1`,
        [
          item.id,
          item.kind,
          item.slug,
          item.title,
          item.summary ?? null,
          item.bodyMd,
          item.authorUserId ?? null,
          item.status,
          item.publishedAt ?? null,
          item.heroImageUrl ?? null,
          item.seoTitle ?? null,
          item.seoDescription ?? null,
          item.taxonomy,
          item.updatedAt,
        ],
      );
      await this.replaceVariants(tx, item.id, item.variantIds);
    });
    return item;
  }

  /**
   * Replace a content row's product links. `variantIds` holds SKUs; a SKU that
   * is not in the catalogue is skipped rather than failing the whole write,
   * which matches how the merchandising store treats an unknown SKU.
   */
  private async replaceVariants(
    tx: Db,
    contentId: string,
    variantIds: string[],
  ): Promise<void> {
    await tx.query(`DELETE FROM catalog.content_products WHERE content_id = $1`, [contentId]);
    for (const sku of variantIds) {
      await tx.query(
        `INSERT INTO catalog.content_products (content_id, variant_id)
         SELECT $1, v.id FROM catalog.variants v WHERE v.sku = $2`,
        [contentId, sku],
      );
    }
  }

  async list(query: ContentListQuery): Promise<ContentItem[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (query.status) {
      params.push(query.status);
      where.push(`status = $${params.length}`);
    }
    if (query.kind) {
      params.push(query.kind);
      where.push(`kind = $${params.length}`);
    }
    // "Any of these tags", matching `matchesTaxonomy` in the in-memory store.
    if (query.taxonomy?.length) {
      params.push(query.taxonomy.map((t) => t.trim().toLowerCase()));
      where.push(`EXISTS (
        SELECT 1 FROM unnest(taxonomy) AS t
        WHERE lower(trim(t)) = ANY($${params.length}::text[])
      )`);
    }
    const limit = query.limit ? ` LIMIT ${Math.floor(query.limit)}` : '';
    const offset = query.offset ? ` OFFSET ${Math.floor(query.offset)}` : '';

    const rows = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ContentRow>(
        `SELECT ${COLUMNS} FROM catalog.content
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY COALESCE(published_at, created_at) DESC${limit}${offset}`,
        params,
      ),
    );
    return this.hydrate(rows.rows);
  }

  async slugs(): Promise<string[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<{ slug: string }>(`SELECT slug FROM catalog.content`),
    );
    return rows.map((r) => r.slug);
  }

  async recipeDetail(contentId: string): Promise<RecipeDetail | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<RecipeRow>(`SELECT * FROM catalog.content_recipes WHERE content_id = $1`, [contentId]),
    );
    return rows[0] ? parseRecipeDetail(rows[0]) : undefined;
  }

  async recipeDetails(contentIds: string[]): Promise<Map<string, RecipeDetail>> {
    const out = new Map<string, RecipeDetail>();
    if (contentIds.length === 0) return out;
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<RecipeRow>(
        `SELECT * FROM catalog.content_recipes WHERE content_id = ANY($1::uuid[])`,
        [contentIds],
      ),
    );
    for (const row of rows) out.set(row.content_id, parseRecipeDetail(row));
    return out;
  }

  async saveRecipeDetail(contentId: string, detail: RecipeDetail): Promise<RecipeDetail> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(
        `INSERT INTO catalog.content_recipes
           (content_id, servings, prep_minutes, cook_minutes, ingredients, steps)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (content_id) DO UPDATE SET
           servings = EXCLUDED.servings,
           prep_minutes = EXCLUDED.prep_minutes,
           cook_minutes = EXCLUDED.cook_minutes,
           ingredients = EXCLUDED.ingredients,
           steps = EXCLUDED.steps`,
        [
          contentId,
          detail.servings,
          detail.prepMinutes,
          detail.cookMinutes,
          JSON.stringify(detail.ingredients),
          JSON.stringify(detail.steps),
        ],
      ),
    );
    return detail;
  }
}
