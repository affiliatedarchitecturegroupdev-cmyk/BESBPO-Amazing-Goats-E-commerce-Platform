import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CycleRecord } from '../cycles/cycle-engine';
import { buildOrder } from './order-builder';
import { Cart, Order } from './orders.types';
import { OrderStore } from './orders.store';

export const ORDER_STORE = Symbol('ORDER_STORE');
export const CYCLE_SOURCE = Symbol('CYCLE_SOURCE');

/** Reads the cycles an order may be assigned to. */
export interface CycleSource {
  list(): Promise<CycleRecord[]>;
}

@Injectable()
export class OrdersService {
  constructor(
    @Inject(ORDER_STORE) private readonly store: OrderStore,
    @Inject(CYCLE_SOURCE) private readonly cycles: CycleSource,
  ) {}

  async list(): Promise<Order[]> {
    return (await this.store.list()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id: string): Promise<Order> {
    const order = await this.store.get(id);
    if (!order) throw new NotFoundException(`unknown order ${id}`);
    return order;
  }

  /** Cart to order: keep each line's fulfilment, assign the open cycle, total the money. */
  async create(cart: Cart, placedAt: Date = new Date()): Promise<Order> {
    const cycles = await this.cycles.list();
    const order = buildOrder(cart, { id: `ord_${placedAt.getTime()}`, placedAt, cycles });
    return this.store.insert(order);
  }
}
