import type { Db } from '@ag/db';
import { currentSession, toIso, toIsoOrUndefined } from '@ag/db';
import type { CycleStatus } from '@ag/shared-types';
import {
  CycleEngineStore,
  CycleOrder,
  CycleRecord,
  OrderLine,
  PickList,
  PurchaseOrder,
} from './cycle-engine';

interface CycleRow {
  id: string;
  code: string;
  product_class: string;
  cutoff_at: Date | string;
  trade_lock_at: Date | string | null;
  top_up_until: Date | string | null;
  slaughter_on: Date | string | null;
  delivery_from: Date | string;
  delivery_to: Date | string;
  status: CycleStatus;
}

function toRecord(row: CycleRow): CycleRecord {
  return {
    id: row.code,
    productClass: row.product_class as CycleRecord['productClass'],
    cutoffAt: toIso(row.cutoff_at),
    tradeLockAt: toIsoOrUndefined(row.trade_lock_at),
    topUpUntil: toIsoOrUndefined(row.top_up_until),
    slaughterOn: toIsoOrUndefined(row.slaughter_on),
    deliveryFrom: toIso(row.delivery_from),
    deliveryTo: toIso(row.delivery_to),
    status: row.status,
  };
}

const COLUMNS =
  'id, code, product_class, cutoff_at, trade_lock_at, top_up_until, slaughter_on, delivery_from, delivery_to, status';

/**
 * SQL adapter over `sales.cycles` and the cycle outputs. The domain id is the
 * deterministic `<class>:<cut-off ISO>` code (not a uuid), so the schema carries
 * it in `code` and the adapter resolves it to the row's uuid where a foreign key
 * is needed. Orders reference cycles.id, so `orders(cycleId)` joins through the
 * code to find them.
 */
export class PgCycleStore implements CycleEngineStore {
  constructor(private readonly db: Db) {}

  /** The uuid for a cycle code, so a foreign key can reference it. */
  private async idFor(tx: Db, code: string): Promise<string | undefined> {
    const { rows } = await tx.query<{ id: string }>(
      `SELECT id FROM sales.cycles WHERE code = $1`,
      [code],
    );
    return rows[0]?.id;
  }

  async list(): Promise<CycleRecord[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<CycleRow>(`SELECT ${COLUMNS} FROM sales.cycles ORDER BY cutoff_at`),
    );
    return rows.map(toRecord);
  }

  async get(id: string): Promise<CycleRecord | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<CycleRow>(`SELECT ${COLUMNS} FROM sales.cycles WHERE code = $1`, [id]),
    );
    return rows[0] ? toRecord(rows[0]) : undefined;
  }

  async insert(cycle: CycleRecord): Promise<CycleRecord> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(
        `INSERT INTO sales.cycles
           (code, product_class, cutoff_at, trade_lock_at, top_up_until, slaughter_on, delivery_from, delivery_to, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (code) DO UPDATE SET
           product_class = EXCLUDED.product_class, cutoff_at = EXCLUDED.cutoff_at,
           trade_lock_at = EXCLUDED.trade_lock_at, top_up_until = EXCLUDED.top_up_until,
           slaughter_on = EXCLUDED.slaughter_on, delivery_from = EXCLUDED.delivery_from,
           delivery_to = EXCLUDED.delivery_to, status = EXCLUDED.status`,
        [
          cycle.id,
          cycle.productClass,
          cycle.cutoffAt,
          cycle.tradeLockAt ?? null,
          cycle.topUpUntil ?? null,
          cycle.slaughterOn ?? null,
          cycle.deliveryFrom,
          cycle.deliveryTo,
          cycle.status,
        ],
      ),
    );
    return cycle;
  }

  async updateStatus(id: string, status: CycleStatus): Promise<void> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(`UPDATE sales.cycles SET status = $2 WHERE code = $1`, [id, status]),
    );
  }

  async orders(cycleId: string): Promise<CycleOrder[]> {
    return this.db.withSession(currentSession(), async (tx) => {
      const uuid = await this.idFor(tx, cycleId);
      if (!uuid) return [];
      const { rows } = await tx.query<{ order_id: string; external_id: string | null; sku: string; qty: string | number }>(
        `SELECT o.id AS order_id, o.external_id, v.sku, ol.qty
           FROM sales.orders o
           JOIN sales.order_lines ol ON ol.order_id = o.id
           JOIN catalog.variants v ON v.id = ol.variant_id
          WHERE o.cycle_id = $1
          ORDER BY o.id, v.sku`,
        [uuid],
      );
      const byOrder = new Map<string, CycleOrder>();
      for (const row of rows) {
        const key = row.external_id ?? row.order_id;
        const order = byOrder.get(key) ?? { id: key, lines: [] as OrderLine[] };
        order.lines.push({ sku: row.sku, qty: Number(row.qty) });
        byOrder.set(key, order);
      }
      return [...byOrder.values()];
    });
  }

  async savePickList(pickList: PickList): Promise<void> {
    await this.db.withSession(currentSession(), async (tx) => {
      const uuid = await this.idFor(tx, pickList.cycleId);
      if (!uuid) return;
      await tx.query(
        `INSERT INTO sales.pick_lists (cycle_id, lines, total_units) VALUES ($1, $2, $3)`,
        [uuid, JSON.stringify(pickList.lines), pickList.totalUnits],
      );
    });
  }

  async savePurchaseOrders(orders: PurchaseOrder[]): Promise<void> {
    await this.db.withSession(currentSession(), async (tx) => {
      for (const order of orders) {
        const uuid = await this.idFor(tx, order.cycleId);
        if (!uuid) continue;
        await tx.query(
          `INSERT INTO sales.cycle_purchase_orders (cycle_id, kind, status, lines) VALUES ($1, $2, $3, $4)`,
          [uuid, order.kind, order.status, JSON.stringify(order.lines)],
        );
      }
    });
  }
}
