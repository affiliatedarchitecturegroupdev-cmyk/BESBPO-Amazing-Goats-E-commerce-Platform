/** A bookable delivery slot on a route, matching logistics.slots. */
export interface Slot {
  id: string;
  routeId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  booked: number;
  earlyWindow: boolean;
}

export interface BookingResult {
  ok: boolean;
  slot: Slot;
  reason?: 'full' | 'closed';
}
