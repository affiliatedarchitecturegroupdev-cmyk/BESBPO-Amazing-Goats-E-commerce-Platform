import type { PartnerDocument, PurchaseOrder, SlaughterSlot } from '@ag/api-client';

/**
 * The partner portal view model: thin aliases over the gateway types plus the
 * pure rules the pages render. The live rows come from `lib/gateway.ts`.
 */
export type PartnerSlot = SlaughterSlot;
export type PartnerOrder = PurchaseOrder;
export type PartnerDoc = PartnerDocument;

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
