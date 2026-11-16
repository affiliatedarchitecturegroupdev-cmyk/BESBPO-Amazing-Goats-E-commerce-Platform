import type { OrderStatus, CycleStatus } from '@ag/shared-types';
import type { Batch, CycleRecord, DeliveryRoute, Order } from '@ag/api-client';

/** The batch fields the admin screen shows. */
export interface BatchRow {
  id: string;
  batchCode: string;
  product: string;
  slaughteredOn?: string;
  useBy?: string;
  temperatureStatus: string;
  status: 'quarantine' | 'released' | 'held' | 'recalled' | 'consumed';
}

/** One row of the admin orders queue. */
export interface OrderRow {
  id: string;
  customer: string;
  slot: string;
  status: OrderStatus;
  statusLabel: string;
}

/** One row of the cut-off cycle table. */
export interface CycleRow {
  id: string;
  label: string;
  cutoffAt: string;
  tradeLockAt?: string;
  topUpUntil?: string;
  filled: number;
  capacity: number;
  status: CycleStatus;
  statusLabel: string;
}

/** One row of the today-routes table. */
export interface RouteRow {
  route: string;
  vehicle: string;
  stops: number;
}

/** A dashboard alert, derived from the day's data. */
export interface Alert {
  title: string;
  action: string;
}

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'New',
  confirmed: 'New',
  in_cycle: 'New',
  packing: 'Packing',
  out_for_delivery: 'Out',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

/** Plain queue label for an internal order status. */
export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABEL[status];
}

const CYCLE_STATUS_LABEL: Record<CycleStatus, string> = {
  scheduled: 'Scheduled',
  open: 'Open',
  locked: 'Locked',
  closed: 'Closed',
  fulfilled: 'Fulfilled',
};

/** One order, as the orders table renders it. */
export function toOrderRow(order: Order): OrderRow {
  return {
    id: order.id,
    customer: order.deliveryAddress?.city ?? '—',
    slot: order.cycleId ?? '—',
    status: order.status,
    statusLabel: orderStatusLabel(order.status),
  };
}

/** One cycle, as the cycle manager renders it. `filled` comes from the cycle's orders. */
export function toCycleRow(cycle: CycleRecord, filled = 0, capacity = 0): CycleRow {
  return {
    id: cycle.id,
    label: cycle.productClass.replace(/_/g, ' '),
    cutoffAt: cycle.cutoffAt,
    tradeLockAt: cycle.tradeLockAt,
    topUpUntil: cycle.topUpUntil,
    filled,
    capacity,
    status: cycle.status,
    statusLabel: CYCLE_STATUS_LABEL[cycle.status],
  };
}

/** One batch, as the stock table renders it. */
export function toBatchRow(batch: Batch): BatchRow {
  return {
    id: batch.id,
    batchCode: batch.batchCode,
    product: batch.sku,
    slaughteredOn: batch.slaughteredOn,
    useBy: batch.useBy,
    temperatureStatus: batch.temperatureStatus,
    status: batch.status,
  };
}

/** One route, as the today-routes table renders it. */
export function toRouteRow(route: DeliveryRoute, stops = 0): RouteRow {
  return { route: route.name, vehicle: route.vehicleId ?? '—', stops };
}

/** The alerts the dashboard shows, derived from the day's stock and orders. */
export function deriveAlerts(batches: BatchRow[], orders: OrderRow[]): Alert[] {
  const alerts: Alert[] = [];
  const warm = batches.filter((b) => b.temperatureStatus !== 'ok');
  if (warm.length > 0) alerts.push({ title: `${warm.length} batch(es) above temperature`, action: 'Check' });
  const held = batches.filter((b) => b.status === 'held' || b.status === 'quarantine');
  if (held.length > 0) alerts.push({ title: `${held.length} batch(es) held`, action: 'Review' });
  const open = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'refunded');
  if (open.length > 0) alerts.push({ title: `${open.length} order(s) in progress`, action: 'Open' });
  return alerts;
}

/** Order queue counts for the chips on the orders screen. */
export function queueCounts(statuses: OrderStatus[]): { new: number; packing: number; out: number; delivered: number } {
  return {
    new: statuses.filter((s) => s === 'pending_payment' || s === 'confirmed' || s === 'in_cycle').length,
    packing: statuses.filter((s) => s === 'packing').length,
    out: statuses.filter((s) => s === 'out_for_delivery').length,
    delivered: statuses.filter((s) => s === 'delivered').length,
  };
}

/** How full a cycle is, as a whole percentage of capacity. */
export function cycleCapacityPct(filled: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.min(100, Math.round((filled / capacity) * 100));
}

/** A cycle closes itself once it is full and the rule is on. */
export function shouldEarlyClose(status: CycleStatus, filled: number, capacity: number, ruleOn: boolean): boolean {
  return ruleOn && status === 'open' && capacity > 0 && filled >= capacity;
}

const BATCH_STATUS_LABEL: Record<BatchRow['status'], string> = {
  quarantine: 'Quarantine',
  released: 'Released',
  held: 'Held',
  recalled: 'Recalled',
  consumed: 'Consumed',
};

/** Batch status label for the table, with a watch tone unless it is sellable. */
export function batchTag(batch: Pick<BatchRow, 'status' | 'temperatureStatus'>): { label: string; tone: 'ok' | 'watch' } {
  const tone = batch.status === 'released' && batch.temperatureStatus === 'ok' ? 'ok' : 'watch';
  return { label: BATCH_STATUS_LABEL[batch.status], tone };
}

/** Plain label for the batch temperature column. */
export function temperatureLabel(temperatureStatus: string): string {
  return temperatureStatus === 'ok' ? 'OK' : 'Watch';
}
