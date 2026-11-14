import { OrderRef } from '../batches/batches.types';
import { affectedOrders } from '../traceability/traceability.domain';

export interface Recall {
  id: string;
  batchId: string;
  reason: string;
  openedBy: string;
  openedAt: string;
  closedAt?: string;
  affectedOrderIds: string[];
}

export interface RecallInput {
  batchId: string;
  reason: string;
  openedBy: string;
}

export interface RecallPlan {
  batchId: string;
  affectedOrderIds: string[];
  notifyCustomer: boolean;
  action: 'block_stock' | 'withdraw_from_customers';
}

/**
 * Decide what a recall does. If stock has already left for customers the batch
 * must be withdrawn from them and they must be told; if it never shipped, block
 * the stock and notify nobody.
 */
export function planRecall(batchId: string, orders: OrderRef[]): RecallPlan {
  const affected = affectedOrders([batchId], orders).map((o) => o.id);
  return {
    batchId,
    affectedOrderIds: affected,
    notifyCustomer: affected.length > 0,
    action: affected.length > 0 ? 'withdraw_from_customers' : 'block_stock',
  };
}

/** Open a recall from an input and the plan its batch implies. */
export function openRecall(id: string, input: RecallInput, orders: OrderRef[], openedAt: Date): Recall {
  const plan = planRecall(input.batchId, orders);
  return {
    id,
    batchId: input.batchId,
    reason: input.reason,
    openedBy: input.openedBy,
    openedAt: openedAt.toISOString(),
    affectedOrderIds: plan.affectedOrderIds,
  };
}
