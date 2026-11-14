/** A slaughter slot a farm or abattoir partner can book. */
export interface SlaughterSlot {
  id: string;
  orgId: string;
  date: string;
  capacity: number;
  booked: number;
  confirmed: boolean;
  halaal: boolean;
}

/** A purchase order a farm partner fulfils. */
export interface PurchaseOrder {
  id: string;
  orgId: string;
  code: string;
  description: string;
  date: string;
  status: 'draft' | 'sent' | 'confirmed';
  grades?: string;
}

/** A compliance document a partner must keep current. */
export interface PartnerDocument {
  id: string;
  orgId: string;
  name: string;
  expiresOn: string;
}

export type DocumentState = 'valid' | 'expiring' | 'expired';

/** Rows a partner may see: only their own org's data. */
export function scopeToOrg<T extends { orgId: string }>(rows: T[], orgId: string): T[] {
  return rows.filter((row) => row.orgId === orgId);
}

/** Unbooked places left on a slot. */
export function slotsAvailable(slot: Pick<SlaughterSlot, 'capacity' | 'booked'>): number {
  return Math.max(0, slot.capacity - slot.booked);
}

/** A slot can be confirmed once, and only while it is not overbooked. */
export function canConfirmSlot(slot: Pick<SlaughterSlot, 'capacity' | 'booked' | 'confirmed'>): { ok: boolean; reason?: string } {
  if (slot.confirmed) return { ok: false, reason: 'already confirmed' };
  if (slot.booked > slot.capacity) return { ok: false, reason: 'overbooked' };
  return { ok: true };
}

/** The same slot, marked confirmed. */
export function confirmSlot(slot: SlaughterSlot): SlaughterSlot {
  return { ...slot, confirmed: true };
}

/** How a document stands against the current date. */
export function documentState(expiresOn: string, now: Date, soonDays = 60): DocumentState {
  const days = Math.floor((new Date(expiresOn).getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return 'expired';
  if (days <= soonDays) return 'expiring';
  return 'valid';
}
