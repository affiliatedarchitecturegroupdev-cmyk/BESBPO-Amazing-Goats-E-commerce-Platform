import type { Db } from '@ag/db';
import { currentSession, toCents, toIso } from '@ag/db';
import type { Address, FulfilmentType, OrderStatus, Temperature } from '@ag/shared-types';
import { Order, OrderLine } from './orders.types';
import { OrderStore } from './orders.store';

interface OrderRow {
  external_id: string;
  cycle_code: string | null;
  status: OrderStatus;
  subtotal_ex_vat_cents: string | number;
  delivery_fee_cents: string | number;
  vat_cents: string | number;
  total_inc_vat_cents: string | number;
  payment_method: string | null;
  delivery_address: Address | null;
  created_at: Date | string;
}

interface LineRow {
  order_id: string;
  sku: string;
  qty: string | number;
  unit_price_ex_vat_cents: string | number;
  fulfilment: FulfilmentType;
  temperature: Temperature;
}

const SELECT_ORDERS = `
  SELECT o.id, o.external_id, cy.code AS cycle_code, o.status, o.subtotal_ex_vat_cents,
         o.delivery_fee_cents, o.vat_cents, o.total_inc_vat_cents, o.payment_method,
         o.delivery_address, o.created_at
    FROM sales.orders o
    LEFT JOIN sales.cycles cy ON cy.id = o.cycle_id`;

function toOrder(row: OrderRow, lines: OrderLine[]): Order {
  return {
    id: row.external_id,
    cycleId: row.cycle_code,
    status: row.status,
    lines,
    subtotalExVatCents: toCents(row.subtotal_ex_vat_cents),
    deliveryFeeCents: toCents(row.delivery_fee_cents),
    vatCents: toCents(row.vat_cents),
    totalIncVatCents: toCents(row.total_inc_vat_cents),
    paymentMethod: row.payment_method ?? undefined,
    deliveryAddress: row.delivery_address ?? undefined,
    createdAt: toIso(row.created_at),
  };
}

function toLine(row: LineRow): OrderLine {
  return {
    sku: row.sku,
    qty: Number(row.qty),
    unitPriceExVatCents: toCents(row.unit_price_ex_vat_cents),
    fulfilment: row.fulfilment,
    temperature: row.temperature,
  };
}

/**
 * SQL adapter over `sales.orders` and `sales.order_lines`. The domain order id is
 * the string `external_id`; the row's uuid is internal. Owner columns
 * (`customer_user_id`, `org_id`) come from the request session, so the RLS policy
 * that scopes an order to its buyer is satisfied on insert as well as on read.
 * A line's `temperature` is read from its variant, which is the source of truth.
 */
export class PgOrderStore implements OrderStore {
  constructor(private readonly db: Db) {}

  private async linesFor(orderIds: string[]): Promise<Map<string, OrderLine[]>> {
    const byOrder = new Map<string, OrderLine[]>();
    if (orderIds.length === 0) return byOrder;
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<LineRow>(
        `SELECT ol.order_id, v.sku, ol.qty, ol.unit_price_ex_vat_cents, ol.fulfilment, v.temperature
           FROM sales.order_lines ol
           JOIN catalog.variants v ON v.id = ol.variant_id
          WHERE ol.order_id = ANY($1)
          ORDER BY ol.id`,
        [orderIds],
      ),
    );
    for (const row of rows) {
      const list = byOrder.get(row.order_id) ?? [];
      list.push(toLine(row));
      byOrder.set(row.order_id, list);
    }
    return byOrder;
  }

  async list(): Promise<Order[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<OrderRow & { id: string }>(`${SELECT_ORDERS} ORDER BY o.created_at DESC`),
    );
    const lines = await this.linesFor(rows.map((r) => r.id));
    return rows.map((row) => toOrder(row, lines.get(row.id) ?? []));
  }

  async get(id: string): Promise<Order | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<OrderRow & { id: string }>(`${SELECT_ORDERS} WHERE o.external_id = $1`, [id]),
    );
    if (!rows[0]) return undefined;
    const lines = await this.linesFor([rows[0].id]);
    return toOrder(rows[0], lines.get(rows[0].id) ?? []);
  }

  async insert(order: Order): Promise<Order> {
    const session = currentSession();
    await this.db.withSession(session, async (tx) => {
      const cycle = order.cycleId
        ? (
            await tx.query<{ id: string }>(`SELECT id FROM sales.cycles WHERE code = $1`, [
              order.cycleId,
            ])
          ).rows[0]?.id ?? null
        : null;
      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO sales.orders
           (external_id, customer_user_id, org_id, cycle_id, status, delivery_address,
            subtotal_ex_vat_cents, delivery_fee_cents, vat_cents, total_inc_vat_cents, payment_method, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (external_id) DO UPDATE SET
           cycle_id = EXCLUDED.cycle_id, status = EXCLUDED.status,
           delivery_address = EXCLUDED.delivery_address, subtotal_ex_vat_cents = EXCLUDED.subtotal_ex_vat_cents,
           delivery_fee_cents = EXCLUDED.delivery_fee_cents, vat_cents = EXCLUDED.vat_cents,
           total_inc_vat_cents = EXCLUDED.total_inc_vat_cents, payment_method = EXCLUDED.payment_method
         RETURNING id`,
        [
          order.id,
          session.userId ?? null,
          session.orgId ?? null,
          cycle,
          order.status,
          order.deliveryAddress ? JSON.stringify(order.deliveryAddress) : null,
          order.subtotalExVatCents,
          order.deliveryFeeCents,
          order.vatCents,
          order.totalIncVatCents,
          order.paymentMethod ?? null,
          order.createdAt,
        ],
      );
      const orderId = inserted.rows[0].id;
      await tx.query(`DELETE FROM sales.order_lines WHERE order_id = $1`, [orderId]);
      for (const line of order.lines) {
        await tx.query(
          `INSERT INTO sales.order_lines (order_id, variant_id, qty, unit_price_ex_vat_cents, fulfilment)
           SELECT $1, v.id, $2, $3, $4 FROM catalog.variants v WHERE v.sku = $5`,
          [orderId, line.qty, line.unitPriceExVatCents, line.fulfilment, line.sku],
        );
      }
    });
    return order;
  }

  async updateStatus(id: string, status: OrderStatus): Promise<void> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(`UPDATE sales.orders SET status = $2 WHERE external_id = $1`, [id, status]),
    );
  }
}
