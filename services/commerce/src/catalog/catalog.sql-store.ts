import type { Db } from '@ag/db';
import { currentSession } from '@ag/db';
import type { Channel, FulfilmentType, Phase, Temperature } from '@ag/shared-types';
import { CatalogueItem } from './catalog.types';
import { CatalogueStore } from './catalog.store';

interface ItemRow {
  sku: string;
  product_slug: string;
  name: string;
  pack: string | null;
  unit: string;
  fulfilment: FulfilmentType;
  temperature: Temperature;
  channel: Channel;
  phase: number;
  line_code: string;
  line_name: string;
  category_slug: string | null;
  halaal_available: boolean;
  active: boolean;
}

/**
 * A variant joined with its product and line, which is what `CatalogueItem`
 * carries. `id` is the SKU (the domain key), `productId` is the product slug,
 * and the line/category are read through the joins.
 */
const SELECT_ITEM = `
  SELECT v.sku, p.slug AS product_slug, p.name, v.pack, v.unit, v.fulfilment, v.temperature,
         v.channel, v.phase, l.code AS line_code, l.name AS line_name,
         c.slug AS category_slug, p.halaal_available, v.active
    FROM catalog.variants v
    JOIN catalog.products p ON p.id = v.product_id
    JOIN catalog.product_lines l ON l.id = p.line_id
    LEFT JOIN catalog.categories c ON c.id = p.category_id`;

function toItem(row: ItemRow): CatalogueItem {
  return {
    id: row.sku,
    sku: row.sku,
    productId: row.product_slug,
    name: row.name,
    pack: row.pack ?? '',
    unit: row.unit,
    fulfilment: row.fulfilment,
    temperature: row.temperature,
    channel: row.channel,
    phase: row.phase as Phase,
    lineCode: row.line_code,
    lineName: row.line_name,
    categorySlug: row.category_slug,
    halaalAvailable: row.halaal_available,
    active: row.active,
  };
}

/** SQL adapter over `catalog.*`; every query runs in the request's RLS session. */
export class PgCatalogueStore implements CatalogueStore {
  constructor(private readonly db: Db) {}

  async all(): Promise<CatalogueItem[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ItemRow>(`${SELECT_ITEM} ORDER BY v.sku`),
    );
    return rows.map(toItem);
  }

  async get(sku: string): Promise<CatalogueItem | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ItemRow>(`${SELECT_ITEM} WHERE v.sku = $1`, [sku]),
    );
    return rows[0] ? toItem(rows[0]) : undefined;
  }

  async upsert(item: CatalogueItem): Promise<CatalogueItem> {
    await this.db.withSession(currentSession(), async (tx) => {
      const line = await tx.query<{ id: number }>(
        `INSERT INTO catalog.product_lines (code, name, grp, phase)
         VALUES ($1, $2, $2, $3)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, phase = EXCLUDED.phase
         RETURNING id`,
        [item.lineCode, item.lineName, item.phase],
      );
      const product = await tx.query<{ id: string }>(
        `INSERT INTO catalog.products (line_id, slug, name, halaal_available, active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (slug) DO UPDATE SET
           line_id = EXCLUDED.line_id, name = EXCLUDED.name,
           halaal_available = EXCLUDED.halaal_available, active = EXCLUDED.active
         RETURNING id`,
        [line.rows[0].id, item.productId, item.name, item.halaalAvailable, item.active],
      );
      await tx.query(
        `INSERT INTO catalog.variants
           (product_id, sku, pack, unit, fulfilment, temperature, channel, phase, source_kind, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'store', $9)
         ON CONFLICT (sku) DO UPDATE SET
           product_id = EXCLUDED.product_id, pack = EXCLUDED.pack, unit = EXCLUDED.unit,
           fulfilment = EXCLUDED.fulfilment, temperature = EXCLUDED.temperature,
           channel = EXCLUDED.channel, phase = EXCLUDED.phase, active = EXCLUDED.active`,
        [
          product.rows[0].id,
          item.sku,
          item.pack,
          item.unit,
          item.fulfilment,
          item.temperature,
          item.channel,
          item.phase,
          item.active,
        ],
      );
    });
    return item;
  }

  async remove(sku: string): Promise<boolean> {
    const result = await this.db.withSession(currentSession(), (tx) =>
      tx.query(`DELETE FROM catalog.variants WHERE sku = $1`, [sku]),
    );
    return (result.rowCount ?? 0) > 0;
  }
}
