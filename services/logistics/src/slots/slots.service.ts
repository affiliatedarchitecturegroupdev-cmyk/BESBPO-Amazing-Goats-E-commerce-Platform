import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BookingResult, Slot } from './slots.types';
import { bookableSlots, isBookable, remaining } from './slot-domain';
import { SlotStore } from './slots.store';

export const SLOT_STORE = Symbol('SLOT_STORE');

@Injectable()
export class SlotsService {
  constructor(@Inject(SLOT_STORE) private readonly store: SlotStore) {}

  async list(): Promise<Slot[]> {
    return (await this.store.list()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async get(id: string): Promise<Slot> {
    const slot = await this.store.get(id);
    if (!slot) throw new NotFoundException(`unknown slot ${id}`);
    return slot;
  }

  /** Slots a customer can pick, earliest first. */
  async available(now: Date = new Date(), opts: { earlyOnly?: boolean } = {}): Promise<Slot[]> {
    return bookableSlots(await this.store.list(), now, opts);
  }

  /** Book one box against a slot; refuses a full or closed slot. */
  async book(id: string, now: Date = new Date()): Promise<BookingResult> {
    const slot = await this.get(id);
    if (!isBookable(slot, now)) {
      return { ok: false, slot, reason: Date.parse(slot.endsAt) <= now.getTime() ? 'closed' : 'full' };
    }
    const booked = slot.capacity - remaining(slot) + 1;
    await this.store.setBooked(id, booked);
    return { ok: true, slot: await this.get(id) };
  }
}
