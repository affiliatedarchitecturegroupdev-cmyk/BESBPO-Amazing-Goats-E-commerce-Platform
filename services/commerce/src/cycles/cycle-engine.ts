import type { CycleStatus } from '@ag/shared-types';
import { ProductClass, chilledMeatCycle } from './cutoff';

/** One cycle row, matching sales.cycles (times as ISO strings for transport). */
export interface CycleRecord {
  id: string;
  productClass: ProductClass;
  cutoffAt: string;
  tradeLockAt?: string;
  topUpUntil?: string;
  slaughterOn?: string;
  deliveryFrom: string;
  deliveryTo: string;
  status: CycleStatus;
}

export interface OrderLine {
  sku: string;
  qty: number;
}

export interface CycleOrder {
  id: string;
  lines: OrderLine[];
}

export interface PickList {
  cycleId: string;
  lines: OrderLine[];
  totalUnits: number;
}

export interface PurchaseOrder {
  cycleId: string;
  kind: 'abattoir' | 'farm';
  status: 'draft';
  lines: OrderLine[];
}

export interface TickReport {
  generated: string[];
  opened: string[];
  closed: string[];
}

export interface CycleEngineStore {
  list(): Promise<CycleRecord[]>;
  insert(cycle: CycleRecord): Promise<CycleRecord>;
  updateStatus(id: string, status: CycleStatus): Promise<void>;
  orders(cycleId: string): Promise<CycleOrder[]>;
  savePickList(pickList: PickList): Promise<void>;
  savePurchaseOrders(orders: PurchaseOrder[]): Promise<void>;
}

/** Deterministic id: a class has one cycle per cut-off instant. */
export function cycleId(productClass: ProductClass, cutoffAt: Date): string {
  return `${productClass}:${cutoffAt.toISOString()}`;
}

/** The next chilled-meat cycle as a record, scheduled by default. */
export function generateCycle(now: Date): CycleRecord {
  const c = chilledMeatCycle(now);
  return {
    id: cycleId('chilled_meat', c.cutoffAt),
    productClass: 'chilled_meat',
    cutoffAt: c.cutoffAt.toISOString(),
    tradeLockAt: c.tradeLockAt?.toISOString(),
    topUpUntil: c.topUpUntil?.toISOString(),
    slaughterOn: c.slaughterOn?.toISOString(),
    deliveryFrom: c.deliveryFrom.toISOString(),
    deliveryTo: c.deliveryTo.toISOString(),
    status: 'scheduled',
  };
}

/** The upcoming cycle(s) that should exist: one open week ahead of `now`. */
export function cyclesToGenerate(existing: CycleRecord[], now: Date): CycleRecord[] {
  const hasFuture = existing.some((c) => Date.parse(c.cutoffAt) > now.getTime());
  return hasFuture ? [] : [generateCycle(now)];
}

export function isDueToClose(cycle: CycleRecord, now: Date): boolean {
  const cutoff = Date.parse(cycle.cutoffAt);
  return Number.isFinite(cutoff) && cutoff <= now.getTime() && cycle.status !== 'closed' && cycle.status !== 'fulfilled';
}

/** Sum each order line by SKU, highest quantity first, for the pick list. */
export function buildPickList(cycleIdValue: string, orders: CycleOrder[]): PickList {
  const bySku = new Map<string, number>();
  for (const order of orders) {
    for (const line of order.lines) bySku.set(line.sku, (bySku.get(line.sku) ?? 0) + line.qty);
  }
  const lines = [...bySku.entries()]
    .map(([sku, qty]) => ({ sku, qty }))
    .sort((a, b) => b.qty - a.qty || a.sku.localeCompare(b.sku));
  return { cycleId: cycleIdValue, lines, totalUnits: lines.reduce((sum, l) => sum + l.qty, 0) };
}

/** One draft purchase order per supplier kind, carrying the pick-list lines. */
export function buildPurchaseOrders(cycleIdValue: string, lines: OrderLine[]): PurchaseOrder[] {
  return (['abattoir', 'farm'] as const).map((kind) => ({ cycleId: cycleIdValue, kind, status: 'draft' as const, lines }));
}

/**
 * One scheduler tick: create the upcoming cycle, open cycles that are still
 * before their cut-off, and close (with purchase orders and a pick list) the
 * cycles whose cut-off has passed.
 */
export async function runCycleTick(store: CycleEngineStore, now: Date): Promise<TickReport> {
  const report: TickReport = { generated: [], opened: [], closed: [] };

  for (const cycle of cyclesToGenerate(await store.list(), now)) {
    await store.insert(cycle);
    report.generated.push(cycle.id);
  }

  for (const cycle of await store.list()) {
    if (isDueToClose(cycle, now)) {
      const orders = await store.orders(cycle.id);
      const pickList = buildPickList(cycle.id, orders);
      await store.savePickList(pickList);
      await store.savePurchaseOrders(buildPurchaseOrders(cycle.id, pickList.lines));
      await store.updateStatus(cycle.id, 'closed');
      report.closed.push(cycle.id);
    } else if (cycle.status === 'scheduled' && Date.parse(cycle.cutoffAt) > now.getTime()) {
      await store.updateStatus(cycle.id, 'open');
      report.opened.push(cycle.id);
    }
  }

  return report;
}
