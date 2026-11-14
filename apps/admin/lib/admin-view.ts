import type { OrderStatus, CycleStatus } from '@ag/shared-types';

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
