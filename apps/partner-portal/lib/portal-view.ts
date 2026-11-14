export interface PartnerSlot {
  id: string;
  date: string;
  capacity: number;
  booked: number;
  confirmed: boolean;
  halaal: boolean;
}

export interface PartnerOrder {
  id: string;
  code: string;
  description: string;
  date: string;
  status: 'draft' | 'sent' | 'confirmed';
}

export interface PartnerDoc {
  id: string;
  name: string;
  expiresOn: string;
}

export type DocumentState = 'valid' | 'expiring' | 'expired';

/** Unbooked places left on a slot. */
export function slotsAvailable(slot: Pick<PartnerSlot, 'capacity' | 'booked'>): number {
  return Math.max(0, slot.capacity - slot.booked);
}

/** How full a slot is, as a whole percentage. */
export function bookedPct(slot: Pick<PartnerSlot, 'capacity' | 'booked'>): number {
  if (slot.capacity <= 0) return 0;
  return Math.min(100, Math.round((slot.booked / slot.capacity) * 100));
}

/** How a document stands against the current date. */
export function documentState(expiresOn: string, now: Date, soonDays = 60): DocumentState {
  const days = Math.floor((new Date(expiresOn).getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return 'expired';
  if (days <= soonDays) return 'expiring';
  return 'valid';
}

/** Short label for the document status column. */
export function documentLabel(state: DocumentState): string {
  if (state === 'expired') return 'Expired';
  if (state === 'expiring') return 'Expiring';
  return 'Valid';
}

/** Short label for the order status. */
export function orderStatusLabel(status: PartnerOrder['status']): string {
  if (status === 'confirmed') return 'Confirmed';
  if (status === 'sent') return 'Sent';
  return 'Draft';
}

/** Demo rows for local runs, until the partners gateway is wired. */
export const DEMO_SLOTS: PartnerSlot[] = [
  { id: 'slot-mon', date: 'Mon', capacity: 120, booked: 98, confirmed: false, halaal: true },
  { id: 'slot-tue', date: 'Tue', capacity: 120, booked: 40, confirmed: false, halaal: true },
];

export const DEMO_ORDERS: PartnerOrder[] = [
  { id: 'po-118', code: 'PO-118', description: '200 broilers', date: 'Wed', status: 'sent' },
];

export const DEMO_DOCS: PartnerDoc[] = [
  { id: 'doc-pack', name: 'Pack station certificate', expiresOn: '2027-03-30' },
  { id: 'doc-halaal', name: 'Halaal certificate', expiresOn: '2027-01-12' },
];
