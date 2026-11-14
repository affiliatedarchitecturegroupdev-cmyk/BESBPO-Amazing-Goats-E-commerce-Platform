import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BATCH_STORE } from '../batches/batches.service';
import { BatchStore } from '../batches/batches.store';
import { OrderRef, StockMovement } from '../batches/batches.types';
import { BatchTrace, traceBatch } from './traceability.domain';

export const MOVEMENT_SOURCE = Symbol('MOVEMENT_SOURCE');
export const ORDER_SOURCE = Symbol('ORDER_SOURCE');

export interface MovementSource {
  list(): Promise<StockMovement[]>;
}
export interface OrderSource {
  list(): Promise<OrderRef[]>;
}

@Injectable()
export class TraceabilityService {
  constructor(
    @Inject(BATCH_STORE) private readonly batches: BatchStore,
    @Inject(MOVEMENT_SOURCE) private readonly movements: MovementSource,
    @Inject(ORDER_SOURCE) private readonly orders: OrderSource,
  ) {}

  /** Full trace for one batch: movements and the orders it supplied. */
  async trace(batchId: string): Promise<BatchTrace> {
    const batch = await this.batches.get(batchId);
    if (!batch) throw new NotFoundException(`unknown batch ${batchId}`);
    return traceBatch(batch, await this.movements.list(), await this.orders.list());
  }
}
