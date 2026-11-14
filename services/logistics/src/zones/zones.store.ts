import { Zone } from './zones.types';

/** Persistence boundary for zones; the SQL adapter lands with the logistics store swap. */
export interface ZoneStore {
  list(): Promise<Zone[]>;
  get(id: number): Promise<Zone | undefined>;
  insert(zone: Zone): Promise<Zone>;
}

/** In-memory zone store used by tests and local runs until the SQL adapter is wired. */
export class InMemoryZoneStore implements ZoneStore {
  private readonly byId = new Map<number, Zone>();

  constructor(seed: Zone[] = []) {
    for (const zone of seed) this.byId.set(zone.id, zone);
  }

  async list(): Promise<Zone[]> {
    return [...this.byId.values()];
  }

  async get(id: number): Promise<Zone | undefined> {
    return this.byId.get(id);
  }

  async insert(zone: Zone): Promise<Zone> {
    this.byId.set(zone.id, zone);
    return zone;
  }
}
