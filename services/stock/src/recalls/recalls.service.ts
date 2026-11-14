import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BATCH_STORE } from '../batches/batches.service';
import { BatchStore } from '../batches/batches.store';
import { ORDER_SOURCE, OrderSource } from '../traceability/traceability.service';
import { Recall, RecallInput, RecallPlan, openRecall, planRecall } from './recalls.domain';
import { RecallStore } from './recalls.store';

export const RECALL_STORE = Symbol('RECALL_STORE');

@Injectable()
export class RecallsService {
  constructor(
    @Inject(RECALL_STORE) private readonly store: RecallStore,
    @Inject(BATCH_STORE) private readonly batches: BatchStore,
    @Inject(ORDER_SOURCE) private readonly orders: OrderSource,
  ) {}

  async list(): Promise<Recall[]> {
    return (await this.store.list()).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  }

  async get(id: string): Promise<Recall> {
    const recall = await this.store.get(id);
    if (!recall) throw new NotFoundException(`unknown recall ${id}`);
    return recall;
  }

  /** What a recall of this batch would touch, without opening it. */
  async plan(batchId: string): Promise<RecallPlan> {
    return planRecall(batchId, await this.orders.list());
  }

  /** Open a recall: find the affected orders and block the batch from sale. */
  async open(input: RecallInput, openedAt: Date = new Date()): Promise<Recall> {
    const recall = openRecall(`rec_${openedAt.getTime()}`, input, await this.orders.list(), openedAt);
    await this.store.insert(recall);
    await this.batches.setStatus(input.batchId, 'recalled');
    return recall;
  }

  async close(id: string, closedAt: Date = new Date()): Promise<Recall> {
    await this.get(id);
    await this.store.close(id, closedAt.toISOString());
    return this.get(id);
  }
}
