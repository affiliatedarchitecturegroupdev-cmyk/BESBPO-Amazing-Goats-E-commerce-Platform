import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Batch, BatchInput, PackSpec } from './batches.types';
import { createBatches, isSellable } from './batch-domain';
import { BatchStore } from './batches.store';

export const BATCH_STORE = Symbol('BATCH_STORE');

@Injectable()
export class BatchesService {
  constructor(@Inject(BATCH_STORE) private readonly store: BatchStore) {}

  async list(): Promise<Batch[]> {
    return (await this.store.list()).sort((a, b) => a.batchCode.localeCompare(b.batchCode));
  }

  async get(id: string): Promise<Batch> {
    const batch = await this.store.get(id);
    if (!batch) throw new NotFoundException(`unknown batch ${id}`);
    return batch;
  }

  /** Sellable batches for a SKU (released and within temperature). */
  async sellable(sku: string): Promise<Batch[]> {
    return (await this.list()).filter((b) => b.sku === sku && isSellable(b));
  }

  /** Record one batch per pack in the intake. */
  async receive(input: BatchInput, packs: PackSpec[]): Promise<Batch[]> {
    const existing = (await this.store.list()).filter((b) => b.batchCode.startsWith(`AG-${input.packedOn.slice(0, 10).replace(/-/g, '')}-`)).length;
    return this.store.insertMany(createBatches(input, packs, existing + 1));
  }

  async release(id: string): Promise<Batch> {
    await this.get(id);
    await this.store.setStatus(id, 'released');
    return this.get(id);
  }
}
