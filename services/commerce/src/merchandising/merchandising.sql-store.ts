import type { Db } from '@ag/db';
import { currentSession, toIso } from '@ag/db';
import { MerchItem, MerchPage, MerchSection } from './merchandising.types';
import { MerchandisingStore } from './merchandising.store';

interface SectionRow {
  id: number;
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
  section_external_id: string;
  sku: string;
  sort: number;
  badge: string | null;
}

function toSection(row: SectionRow): MerchSection {
  return {
    id: row.external_id,
    code: row.code,
    title: row.title,
    page: row.page,
    sort: row.sort,
    active: row.active,
    startsAt: row.starts_at ? toIso(row.starts_at) : null,
    endsAt: row.ends_at ? toIso(row.ends_at) : null,
  };
}

function toItem(row: ItemRow): MerchItem {
  return { sectionId: row.section_external_id, sku: row.sku, sort: row.sort, badge: row.badge };
}

const SELECT_ITEMS = `
  SELECT s.external_id AS section_external_id, v.sku, i.sort, i.badge
    FROM catalog.merch_items i
    JOIN catalog.merch_sections s ON s.id = i.section_id
    JOIN catalog.variants v ON v.id = i.variant_id`;

/**
 * SQL adapter over `catalog.merch_sections` and `catalog.merch_items`. The
 * domain section id is the string `external_id`; the table's serial `id` is the
 * internal join key, and an item's variant is resolved by SKU.
 */
export class PgMerchandisingStore implements MerchandisingStore {
  constructor(private readonly db: Db) {}

  private async idFor(tx: Db, externalId: string): Promise<number | undefined> {
    const { rows } = await tx.query<{ id: number }>(
      `SELECT id FROM catalog.merch_sections WHERE external_id = $1`,
      [externalId],
    );
    return rows[0]?.id;
  }

  async sections(): Promise<MerchSection[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<SectionRow>(
        `SELECT id, external_id, code, title, page, sort, active, starts_at, ends_at
           FROM catalog.merch_sections ORDER BY page, sort, code`,
      ),
    );
    return rows.map(toSection);
  }

  async getSection(id: string): Promise<MerchSection | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<SectionRow>(
        `SELECT id, external_id, code, title, page, sort, active, starts_at, ends_at
           FROM catalog.merch_sections WHERE external_id = $1`,
        [id],
      ),
    );
    return rows[0] ? toSection(rows[0]) : undefined;
  }

  async saveSection(section: MerchSection): Promise<MerchSection> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(
        `INSERT INTO catalog.merch_sections (external_id, code, title, page, sort, active, starts_at, ends_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (external_id) DO UPDATE SET
           code = EXCLUDED.code, title = EXCLUDED.title, page = EXCLUDED.page, sort = EXCLUDED.sort,
           active = EXCLUDED.active, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at`,
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
    return section;
  }

  async items(): Promise<MerchItem[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ItemRow>(`${SELECT_ITEMS} ORDER BY i.sort, v.sku`),
    );
    return rows.map(toItem);
  }

  async itemsForSection(sectionId: string): Promise<MerchItem[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ItemRow>(`${SELECT_ITEMS} WHERE s.external_id = $1 ORDER BY i.sort, v.sku`, [sectionId]),
    );
    return rows.map(toItem);
  }

  async replaceItems(sectionId: string, items: MerchItem[]): Promise<MerchItem[]> {
    await this.db.withSession(currentSession(), async (tx) => {
      const id = await this.idFor(tx, sectionId);
      if (id === undefined) throw new Error(`merchandising section ${sectionId} not found`);
      await tx.query(`DELETE FROM catalog.merch_items WHERE section_id = $1`, [id]);
      for (const item of items) {
        await tx.query(
          `INSERT INTO catalog.merch_items (section_id, variant_id, sort, badge)
           SELECT $1, v.id, $2, $3 FROM catalog.variants v WHERE v.sku = $4`,
          [id, item.sort, item.badge, item.sku],
        );
      }
    });
    return items.map((item) => ({ ...item, sectionId }));
  }
}
