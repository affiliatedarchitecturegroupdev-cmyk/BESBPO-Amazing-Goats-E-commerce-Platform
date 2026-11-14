import { Inject, Injectable } from '@nestjs/common';
import { CycleRecord, CycleEngineStore, runCycleTick, TickReport } from './cycle-engine';

export const CYCLE_STORE = Symbol('CYCLE_STORE');

/** Trade roles (and staff) may see trade-cycle detail; everyone else gets the public view. */
export function canManageCycles(permissions: readonly string[]): boolean {
  return permissions.includes('cycles:manage');
}

@Injectable()
export class CyclesService {
  constructor(@Inject(CYCLE_STORE) private readonly store: CycleEngineStore) {}

  async list(): Promise<CycleRecord[]> {
    return (await this.store.list()).sort((a, b) => a.cutoffAt.localeCompare(b.cutoffAt));
  }

  /** The next cycle still open, or the soonest upcoming one. */
  async current(now: Date = new Date()): Promise<CycleRecord | null> {
    const cycles = await this.list();
    const upcoming = cycles.filter((c) => Date.parse(c.cutoffAt) > now.getTime());
    return upcoming[0] ?? cycles[cycles.length - 1] ?? null;
  }

  async tick(now: Date = new Date()): Promise<TickReport> {
    return runCycleTick(this.store, now);
  }
}
