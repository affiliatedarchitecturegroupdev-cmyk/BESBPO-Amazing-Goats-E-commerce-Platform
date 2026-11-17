import type { Db } from '@ag/db';
import { currentSession, toIso } from '@ag/db';
import { OrderRef, StockMovement } from '../batches/batches.types';
import { MovementSource, OrderSource } from './traceability.service';

interface MovementRow {
  batch_ref: string | null;
  kind: string;
  qty: string | number;
  ref_type: string | null;
  ref_id: string | null;
  at: Date | string;
}

interface OrderLineRow {
  order_ref: string;
  sku: string;
  batch_ref: string | null;
}

/** SQL source of stock movements, over `inventory.stock_movements`. */
export class PgMovementSource implements MovementSource {
  constructor(private readonly db: Db) {}

  async list(): Promise<StockMovement[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<MovementRow>(
        `SELECT b.external_id AS batch_ref, m.kind, m.qty, m.ref_type, m.ref_id, m.at
           FROM inventory.stock_movements m
           LEFT JOIN inventory.batches b ON b.id = m.batch_id
         ORDER BY m.at`,
      ),
    );
    return rows.map((row) => ({
      batchId: row.batch_ref ?? '',
      kind: row.kind,
      qty: Number(row.qty),
      ...(row.ref_type ? { refType: row.ref_type } : {}),
      ...(row.ref_id ? { refId: row.ref_id } : {}),
      at: toIso(row.at),
    }));
  }
}

/**
 * SQL source of order references, over `sales.order_lines`. The order is
 * identified by its uuid (there is no domain id on an order); each line carries
 * the variant SKU and the batch's domain id, so a recall can find the orders a
 * batch supplied.
 */
export class PgOrderSource implements OrderSource {
  constructor(private readonly db: Db) {}

  async list(): Promise<OrderRef[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<OrderLineRow>(
        `SELECT o.id::text AS order_ref, v.sku, b.external_id AS batch_ref
           FROM sales.order_lines l
           JOIN sales.orders o ON o.id = l.order_id
           JOIN catalog.variants v ON v.id = l.variant_id
           LEFT JOIN inventory.batches b ON b.id = l.batch_id
         ORDER BY o.id`,
      ),
    );
    const byOrder = new Map<string, OrderRef>();
    for (const row of rows) {
      const order = byOrder.get(row.order_ref) ?? { id: row.order_ref, lines: [] };
      order.lines.push({ sku: row.sku, ...(row.batch_ref ? { batchId: row.batch_ref } : {}) });
      byOrder.set(row.order_ref, order);
    }
    return [...byOrder.values()];
  }
}
