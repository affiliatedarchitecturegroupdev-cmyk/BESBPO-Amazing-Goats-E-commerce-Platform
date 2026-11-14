import type { CycleStatus } from '@ag/shared-types';
import { CycleEngineStore, CycleOrder, CycleRecord, PickList, PurchaseOrder } from './cycle-engine';

/** In-memory cycle store used by tests and local runs until the SQL adapter lands. */
export class InMemoryCycleStore implements CycleEngineStore {
  private readonly cycles = new Map<string, CycleRecord>();
  private readonly ordersByCycle = new Map<string, CycleOrder[]>();
  readonly pickLists: PickList[] = [];
  readonly purchaseOrders: PurchaseOrder[] = [];

  constructor(seed: CycleRecord[] = [], orders: Record<string, CycleOrder[]> = {}) {
    for (const cycle of seed) this.cycles.set(cycle.id, cycle);
    for (const [cycleId, list] of Object.entries(orders)) this.ordersByCycle.set(cycleId, list);
  }

  async list(): Promise<CycleRecord[]> {
    return [...this.cycles.values()];
  }

  async get(id: string): Promise<CycleRecord | undefined> {
    return this.cycles.get(id);
  }

  async insert(cycle: CycleRecord): Promise<CycleRecord> {
    this.cycles.set(cycle.id, cycle);
    return cycle;
  }

  async updateStatus(id: string, status: CycleStatus): Promise<void> {
    const cycle = this.cycles.get(id);
    if (cycle) this.cycles.set(id, { ...cycle, status });
  }

  async orders(cycleId: string): Promise<CycleOrder[]> {
    return this.ordersByCycle.get(cycleId) ?? [];
  }

  async savePickList(pickList: PickList): Promise<void> {
    this.pickLists.push(pickList);
  }

  async savePurchaseOrders(orders: PurchaseOrder[]): Promise<void> {
    this.purchaseOrders.push(...orders);
  }
}
