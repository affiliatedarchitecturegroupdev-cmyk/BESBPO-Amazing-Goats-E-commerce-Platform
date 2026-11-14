import { Batch, OrderRef, StockMovement } from '../batches/batches.types';

/** Everything a recall or audit needs to see for one batch. */
export interface BatchTrace {
  batch: Batch;
  movements: StockMovement[];
  orders: OrderRef[];
  orderCount: number;
}

/** Join a batch to its movements and the orders that took stock from it. */
export function traceBatch(batch: Batch, movements: StockMovement[], orders: OrderRef[]): BatchTrace {
  const batchMovements = movements.filter((m) => m.batchId === batch.id);
  const affected = orders.filter((o) => o.lines.some((l) => l.batchId === batch.id));
  return { batch, movements: batchMovements, orders: affected, orderCount: affected.length };
}

/** Orders that received any stock from the given batches (used by a recall). */
export function affectedOrders(batchIds: string[], orders: OrderRef[]): OrderRef[] {
  const ids = new Set(batchIds);
  return orders.filter((o) => o.lines.some((l) => l.batchId && ids.has(l.batchId)));
}
