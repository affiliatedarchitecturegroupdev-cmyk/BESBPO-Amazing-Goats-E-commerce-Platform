import type { Db } from '@ag/db';
import { currentSession, toCents, toIso, toIsoOrUndefined } from '@ag/db';
import { PriceList, PriceListAudience, PriceListItem, PriceListStatus } from './pricing.types';
import { PricingStore } from './pricing.store';

interface ListRow {
  external_id: string;
  code: string;
  name: string;
  audience: PriceListAudience;
  valid_from: Date | string;
  valid_to: Date | string | null;
  status: PriceListStatus;
  requested_by: string | null;
  approved_by: string | null;
  published_at: Date | string | null;
}

interface ItemRow {
  price_list_id: string;
  sku: string;
  price_ex_vat_cents: string | number;
  unit_price_basis: string;
}

function toList(row: ListRow, items: PriceListItem[]): PriceList {
  return {
    id: row.external_id,
    code: row.code,
    name: row.name,
    audience: row.audience,
    validFrom: toIso(row.valid_from),
    validTo: row.valid_to ? toIso(row.valid_to) : null,
    status: row.status,
    items,
    requestedBy: row.requested_by ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    publishedAt: toIsoOrUndefined(row.published_at),
  };
}

const LIST_COLUMNS =
  'external_id, code, name, audience, valid_from, valid_to, status, requested_by, approved_by, published_at';

/** SQL adapter over `catalog.price_lists` and `catalog.price_list_items`. */
export class PgPricingStore implements PricingStore {
  constructor(private readonly db: Db) {}

  /** The uuid for a list's domain id, so the item foreign key can reference it. */
  private async idFor(tx: Db, externalId: string): Promise<string | undefined> {
    const { rows } = await tx.query<{ id: string }>(
      `SELECT id FROM catalog.price_lists WHERE external_id = $1`,
      [externalId],
    );
    return rows[0]?.id;
  }

  /** The items for a set of lists, keyed by the list's uuid (internal join key). */
  private async itemsFor(listIds: string[]): Promise<Map<string, PriceListItem[]>> {
    const byList = new Map<string, PriceListItem[]>();
    if (listIds.length === 0) return byList;
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ItemRow>(
        `SELECT i.price_list_id, v.sku, i.price_ex_vat_cents, i.unit_price_basis
           FROM catalog.price_list_items i
           JOIN catalog.variants v ON v.id = i.variant_id
          WHERE i.price_list_id = ANY($1)`,
        [listIds],
      ),
    );
    for (const row of rows) {
      const list = byList.get(row.price_list_id) ?? [];
      list.push({
        sku: row.sku,
        priceExVatCents: toCents(row.price_ex_vat_cents),
        unitPriceBasis: row.unit_price_basis,
      });
      byList.set(row.price_list_id, list);
    }
    return byList;
  }

  async all(): Promise<PriceList[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ListRow & { id: string }>(`SELECT id, ${LIST_COLUMNS} FROM catalog.price_lists ORDER BY code`),
    );
    const items = await this.itemsFor(rows.map((r) => r.id));
    return rows.map((row) => toList(row, items.get(row.id) ?? []));
  }

  async get(id: string): Promise<PriceList | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ListRow & { id: string }>(
        `SELECT id, ${LIST_COLUMNS} FROM catalog.price_lists WHERE external_id = $1`,
        [id],
      ),
    );
    if (!rows[0]) return undefined;
    const items = await this.itemsFor([rows[0].id]);
    return toList(rows[0], items.get(rows[0].id) ?? []);
  }

  async insert(list: PriceList): Promise<PriceList> {
    return this.write(list, false);
  }

  async replace(list: PriceList): Promise<PriceList> {
    return this.write(list, true);
  }

  /** Insert or update a list and rewrite its items, in one transaction. */
  private async write(list: PriceList, mustExist: boolean): Promise<PriceList> {
    await this.db.withSession(currentSession(), async (tx) => {
      if (mustExist && !(await this.idFor(tx, list.id))) {
        throw new Error(`price list ${list.id} not found`);
      }
      await tx.query(
        `INSERT INTO catalog.price_lists
           (external_id, code, name, audience, valid_from, valid_to, status, requested_by, approved_by, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (external_id) DO UPDATE SET
           code = EXCLUDED.code, name = EXCLUDED.name, audience = EXCLUDED.audience,
           valid_from = EXCLUDED.valid_from, valid_to = EXCLUDED.valid_to, status = EXCLUDED.status,
           requested_by = EXCLUDED.requested_by, approved_by = EXCLUDED.approved_by,
           published_at = EXCLUDED.published_at`,
        [
          list.id,
          list.code,
          list.name,
          list.audience,
          list.validFrom,
          list.validTo,
          list.status,
          list.requestedBy ?? null,
          list.approvedBy ?? null,
          list.publishedAt ?? null,
        ],
      );

      const priceListId = await this.idFor(tx, list.id);
      if (!priceListId) throw new Error(`price list ${list.id} not found after write`);
      // Items are rewritten wholesale: a price list is versioned, so its items
      // are immutable once a newer version supersedes it.
      await tx.query(`DELETE FROM catalog.price_list_items WHERE price_list_id = $1`, [priceListId]);
      for (const item of list.items) {
        await tx.query(
          `INSERT INTO catalog.price_list_items (price_list_id, variant_id, price_ex_vat_cents, unit_price_basis)
           SELECT $1, v.id, $2, $3 FROM catalog.variants v WHERE v.sku = $4`,
          [priceListId, item.priceExVatCents, item.unitPriceBasis, item.sku],
        );
      }
    });
    return list;
  }
}
