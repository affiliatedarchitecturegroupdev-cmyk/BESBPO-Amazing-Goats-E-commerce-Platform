import type { OrderStatus, CycleStatus } from '@ag/shared-types';
import type { BatchRow } from './admin-view';

export interface OrderRow {
  id: string;
  customer: string;
  slot: string;
  status: OrderStatus;
  statusLabel: string;
}

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

export interface RouteRow {
  route: string;
  vehicle: string;
  stops: number;
}

export interface Alert {
  title: string;
  action: string;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'New',
  confirmed: 'New',
  in_cycle: 'New',
  packing: 'Packing',
  out_for_delivery: 'Out',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export function orderStatusLabel(status: OrderStatus): string {
  return STATUS_LABEL[status];
}

/** Demo rows for local runs, until the gateway is wired to commerce and stock. */
export const DEMO_ORDERS: OrderRow[] = [
  { id: '#2041', customer: 'Trade A', slot: 'Wed am', status: 'confirmed', statusLabel: orderStatusLabel('confirmed') },
  { id: '#2042', customer: 'Household', slot: 'Wed pm', status: 'in_cycle', statusLabel: orderStatusLabel('in_cycle') },
  { id: '#2043', customer: 'Trader', slot: 'Thu', status: 'packing', statusLabel: orderStatusLabel('packing') },
  { id: '#2044', customer: 'Butchery B', slot: 'Wed am', status: 'out_for_delivery', statusLabel: orderStatusLabel('out_for_delivery') },
  { id: '#2045', customer: 'Cafe C', slot: 'Wed am', status: 'delivered', statusLabel: orderStatusLabel('delivered') },
];

export const DEMO_CYCLES: CycleRow[] = [
  { id: 'chilled-wk46', label: 'Chilled wk 46', cutoffAt: 'Sun 17:00', tradeLockAt: 'Sun 12:00', topUpUntil: 'Mon 12:00', filled: 820, capacity: 1000, status: 'open', statusLabel: 'Open' },
  { id: 'eggs-wk46', label: 'Eggs wk 46', cutoffAt: 'Mon 04:00', filled: 400, capacity: 1000, status: 'open', statusLabel: 'Open' },
];

export const DEMO_BATCHES: BatchRow[] = [
  { id: 'L-1108', batchCode: 'AG-20261106-0001', product: 'Lamb carcass', slaughteredOn: '06 Nov', useBy: '16 Nov', temperatureStatus: 'ok', status: 'released' },
  { id: 'L-1109', batchCode: 'AG-20261106-0002', product: 'Loin chops', slaughteredOn: '06 Nov', useBy: '14 Nov', temperatureStatus: 'watch', status: 'held' },
];

export const DEMO_ROUTES: RouteRow[] = [
  { route: 'North Coast', vehicle: 'Van 1', stops: 12 },
  { route: 'Durban', vehicle: 'Truck 1', stops: 18 },
];

export const DEMO_ALERTS: Alert[] = [
  { title: 'Van 2 above 5°C', action: 'Check' },
  { title: 'Lamb chops low stock', action: 'Reorder' },
  { title: '3 accounts overdue', action: 'Review' },
];

export const DEMO_KPIS = [
  { value: '38', label: 'Orders today' },
  { value: '26 h', label: 'To cut-off' },
  { value: '82%', label: 'Slaughter slot booked' },
  { value: 'R ---', label: 'Revenue today' },
];
