import type { Db } from '@ag/db';
import { currentSession, toIsoOrUndefined } from '@ag/db';
import { MerchItem, MerchPage, MerchSection } from './merchandising.types';
import { MerchandisingStore } from './merchandising.store';

interface SectionRow {
  external_id: string;
  code: string;
  title: string;
  page: MerchPage;
  sort: number;
  active: boolean;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
}

interface ItemRow {
  external_id: string;
  sku: string;
  sort: number;
  badge: string | null;
}

// The domain id is an opaque string (`sec_home_hero`); the schema keys a section
// on a serial integer, so the domain id is carried in `external_id` (migration
// 0018) and resolved to the integer where the item foreign key needs it.
const SECTION_COLUMNS = 'external_id, code, title, page, sort, active, starts_at, ends_at';

/** An item joined to its section, so it carries the section's domain id. */
const SELECT_ITEMS = `
  SELECT s.external_id, v.sku, i.sort, i.badge
    FROM catalog.merch_items i
    JOIN catalog.merch_sections s ON s.id = i.section_id
    JOIN catalog.variants v ON v.id = i.variant_id`;

function toSection(row: SectionRow): MerchSection {
  return {
    id: row.external_id,
    code: row.code,
    title: row.title,
    page: row.page,
    sort: row.sort,
    active: row.active,
    startsAt: toIsoOrUndefined(row.starts_at) ?? null,
    endsAt: toIsoOrUndefined(row.ends_at) ?? null,
  };
}

function toItem(row: ItemRow): MerchItem {
  return { sectionId: row.external_id, sku: row.sku, sort: row.sort, badge: row.badge };
}

/**
 * SQL adapter over `catalog.merch_sections` and `catalog.merch_items`. Every
 * query runs in the request's RLS session: a staff session manages every
 * section, while a public read sees only the active, in-window rows the policy
 * allows (migration 0018), so the store cannot surface a draft or an expired
 * strip even if the caller is unauthenticated.
 */
export class PgMerchandisingStore implements MerchandisingStore {
  constructor(private readonly db: Db) {}

  async sections(): Promise<MerchSection[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<SectionRow>(`SELECT ${SECTION_COLUMNS} FROM catalog.merch_sections ORDER BY page, sort, code`),
    );
    return rows.map(toSection);
  }

  async getSection(id: string): Promise<MerchSection | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<SectionRow>(`SELECT ${SECTION_COLUMNS} FROM catalog.merch_sections WHERE external_id = $1`, [id]),
    );
    return rows[0] ? toSection(rows[0]) : undefined;
  }

  async saveSection(section: MerchSection): Promise<MerchSection> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<SectionRow>(
        `INSERT INTO catalog.merch_sections (external_id, code, title, page, sort, active, starts_at, ends_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (external_id) DO UPDATE SET
           code = EXCLUDED.code, title = EXCLUDED.title, page = EXCLUDED.page, sort = EXCLUDED.sort,
           active = EXCLUDED.active, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at
         RETURNING ${SECTION_COLUMNS}`,
        [
          section.id,
          section.code,
          section.title,
          section.page,
          section.sort,
          section.active,
          section.startsAt,
          section.endsAt,
        ],
      ),
    );
    return toSection(rows[0]);
  }

  async items(): Promise<MerchItem[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ItemRow>(`${SELECT_ITEMS} ORDER BY s.page, s.sort, s.code, i.sort, v.sku`),
    );
    return rows.map(toItem);
  }

  async itemsForSection(sectionId: string): Promise<MerchItem[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ItemRow>(`${SELECT_ITEMS} WHERE s.external_id = $1 ORDER BY i.sort, v.sku`, [sectionId]),
    );
    return rows.map(toItem);
  }

  /** Replace a section's items wholesale; an unknown SKU is skipped, as at read. */
  async replaceItems(sectionId: string, items: MerchItem[]): Promise<MerchItem[]> {
    await this.db.withSession(currentSession(), async (tx) => {
      const { rows } = await tx.query<{ id: number }>(
        `SELECT id FROM catalog.merch_sections WHERE external_id = $1`,
        [sectionId],
      );
      const sectionPk = rows[0]?.id;
      if (sectionPk === undefined) throw new Error(`merchandising section ${sectionId} not found`);
      await tx.query(`DELETE FROM catalog.merch_items WHERE section_id = $1`, [sectionPk]);
      for (const item of items) {
        await tx.query(
          `INSERT INTO catalog.merch_items (section_id, variant_id, sort, badge)
           SELECT $1, v.id, $2, $3 FROM catalog.variants v WHERE v.sku = $4`,
          [sectionPk, item.sort, item.badge, item.sku],
        );
      }
    });
    return items;
  }
}
