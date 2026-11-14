import { Slot } from './slots.types';

/** Persistence boundary for slots; the SQL adapter lands with the logistics store swap. */
export interface SlotStore {
  list(): Promise<Slot[]>;
  get(id: string): Promise<Slot | undefined>;
  insert(slot: Slot): Promise<Slot>;
  setBooked(id: string, booked: number): Promise<void>;
}

/** In-memory slot store used by tests and local runs until the SQL adapter is wired. */
export class InMemorySlotStore implements SlotStore {
  private readonly byId = new Map<string, Slot>();

  constructor(seed: Slot[] = []) {
    for (const slot of seed) this.byId.set(slot.id, slot);
  }

  async list(): Promise<Slot[]> {
    return [...this.byId.values()];
  }

  async get(id: string): Promise<Slot | undefined> {
    return this.byId.get(id);
  }

  async insert(slot: Slot): Promise<Slot> {
    this.byId.set(slot.id, slot);
    return slot;
  }

  async setBooked(id: string, booked: number): Promise<void> {
    const slot = this.byId.get(id);
    if (slot) this.byId.set(id, { ...slot, booked });
  }
}
