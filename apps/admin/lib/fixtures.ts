import type { Batch, CycleRecord, DeliveryRoute, Order } from '@ag/api-client';
import type { AdReport, AuditRecord, Invoice, PriceList } from '@ag/api-client';
import { orderStatusLabel, type BatchRow, type CycleRow, type OrderRow, type RouteRow } from './admin-view';

/**
 * Test fixtures only (T-050): the demo rows that used to feed the pages now
 * live here, in the shape the gateway returns, so specs can exercise the real
 * mapping and rendering code without a running gateway.
 */
export const FIXTURE_ORDERS: Order[] = [
  { id: 'o-2041', cycleId: 'chilled-wk46', status: 'confirmed', lines: [], subtotalExVatCents: 1000, deliveryFeeCents: 0, vatCents: 150, totalIncVatCents: 1150, createdAt: '2026-11-16T08:00:00Z' },
  { id: 'o-2042', cycleId: 'chilled-wk46', status: 'packing', lines: [], subtotalExVatCents: 2000, deliveryFeeCents: 0, vatCents: 300, totalIncVatCents: 2300, createdAt: '2026-11-16T08:10:00Z' },
  { id: 'o-2043', cycleId: 'eggs-wk46', status: 'out_for_delivery', lines: [], subtotalExVatCents: 3000, deliveryFeeCents: 0, vatCents: 450, totalIncVatCents: 3450, createdAt: '2026-11-16T08:20:00Z' },
];

export const FIXTURE_CYCLES: CycleRecord[] = [
  { id: 'chilled-wk46', productClass: 'chilled_meat', cutoffAt: '2026-11-15T15:00:00Z', tradeLockAt: '2026-11-15T10:00:00Z', topUpUntil: '2026-11-16T10:00:00Z', deliveryFrom: '2026-11-18T04:00:00Z', deliveryTo: '2026-11-20T16:00:00Z', status: 'open' },
];

export const FIXTURE_BATCHES: Batch[] = [
  { id: 'L-1108', batchCode: 'AG-20261106-0001', sku: 'AG-LM-001', pack: 'Carcass', slaughteredOn: '2026-11-06', useBy: '2026-11-16', halaalCertified: true, temperatureStatus: 'ok', status: 'released' },
  { id: 'L-1109', batchCode: 'AG-20261106-0002', sku: 'AG-LM-002', pack: 'Loin chops', slaughteredOn: '2026-11-06', useBy: '2026-11-14', halaalCertified: true, temperatureStatus: 'watch', status: 'held' },
];

export const FIXTURE_ROUTES: DeliveryRoute[] = [
  { id: 'r-north', name: 'North Coast', dayOfWeek: 3, vehicleId: 'Van 1', capacityBoxes: 60 },
  { id: 'r-durban', name: 'Durban', dayOfWeek: 3, vehicleId: 'Truck 1', capacityBoxes: 120 },
];

export const FIXTURE_AUDIT: AuditRecord[] = [
  { at: '2026-11-16T08:05:00Z', actorUserId: 'u-1', action: 'POST /commerce/orders', entity: '/commerce/orders' },
];

export const FIXTURE_INVOICES: Invoice[] = [
  { id: 'inv-1', number: 'INV-1042', orgId: 'org-demo', issuedOn: '2026-11-01', dueOn: '2026-11-30', subtotalExVatCents: 100000, vatCents: 15000, totalIncVatCents: 115000, status: 'open', lines: [] },
];

export const FIXTURE_PRICE_LISTS: PriceList[] = [
  { id: 'pl-public', code: 'PUBLIC-2026', name: 'Public 2026', audience: 'public', validFrom: '2026-01-01', validTo: null, status: 'published', items: [] },
];

export const FIXTURE_AD_REPORT: AdReport = { impressions: 12400, clicks: 340, clickThroughPct: 2.7 };

/** Rows the tables render, mapped from the fixtures above. */
export const FIXTURE_ORDER_ROWS: OrderRow[] = FIXTURE_ORDERS.map((o) => ({
  id: o.id,
  customer: 'Household',
  slot: o.cycleId ?? '—',
  status: o.status,
  statusLabel: orderStatusLabel(o.status),
}));

export const FIXTURE_CYCLE_ROWS: CycleRow[] = [
  { id: 'chilled-wk46', label: 'chilled meat', cutoffAt: 'Sun 17:00', tradeLockAt: 'Sun 12:00', topUpUntil: 'Mon 12:00', filled: 820, capacity: 1000, status: 'open', statusLabel: 'Open' },
];

export const FIXTURE_BATCH_ROWS: BatchRow[] = [
  { id: 'L-1108', batchCode: 'AG-20261106-0001', product: 'Lamb carcass', slaughteredOn: '06 Nov', useBy: '16 Nov', temperatureStatus: 'ok', status: 'released' },
  { id: 'L-1109', batchCode: 'AG-20261106-0002', product: 'Loin chops', slaughteredOn: '06 Nov', useBy: '14 Nov', temperatureStatus: 'watch', status: 'held' },
];

export const FIXTURE_ROUTE_ROWS: RouteRow[] = [
  { route: 'North Coast', vehicle: 'Van 1', stops: 12 },
  { route: 'Durban', vehicle: 'Truck 1', stops: 18 },
];
