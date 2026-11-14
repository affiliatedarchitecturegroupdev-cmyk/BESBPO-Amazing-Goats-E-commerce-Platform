import { Slot } from './slots.types';

export function remaining(slot: Slot): number {
  return Math.max(0, slot.capacity - slot.booked);
}

/** Is there room on the slot, and is it still open (not past its end time)? */
export function isBookable(slot: Slot, now: Date): boolean {
  return remaining(slot) > 0 && Date.parse(slot.endsAt) > now.getTime();
}

/** Slots a customer can pick, earliest first, optionally only bakery early windows. */
export function bookableSlots(slots: Slot[], now: Date, opts: { earlyOnly?: boolean } = {}): Slot[] {
  return slots
    .filter((s) => isBookable(s, now) && (!opts.earlyOnly || s.earlyWindow))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
