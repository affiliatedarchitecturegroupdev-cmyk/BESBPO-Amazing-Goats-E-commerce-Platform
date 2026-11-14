import { Batch, BatchStatus } from './batches.types';

/** Persistence boundary for batches; the SQL adapter lands with the stock store swap. */
export interface BatchStore {
  list(): Promise<Batch[]>;
  get(id: string): Promise<Batch | undefined>;
  insertMany(batches: Batch[]): Promise<Batch[]>;
  setStatus(id: string, status: Batch['status']): Promise<void>;
}

/** In-memory batch store used by tests and local runs until the SQL adapter is wired. */
export class InMemoryBatchStore implements BatchStore {
  private readonly byId = new Map<string, Batch>();

  constructor(seed: Batch[] = []) {
    for (const batch of seed) this.byId.set(batch.id, batch);
  }

  async list(): Promise<Batch[]> {
    return [...this.byId.values()];
  }

  async get(id: string): Promise<Batch | undefined> {
    return this.byId.get(id);
  }

  async insertMany(batches: Batch[]): Promise<Batch[]> {
    for (const batch of batches) this.byId.set(batch.id, batch);
    return batches;
  }

  async setStatus(id: string, status: BatchStatus): Promise<void> {
    const batch = this.byId.get(id);
    if (batch) this.byId.set(id, { ...batch, status });
  }
}
