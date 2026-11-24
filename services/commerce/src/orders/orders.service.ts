import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { CycleRecord } from '../cycles/cycle-engine';
import { buildOrder } from './order-builder';
import { Caller, PublicOrder, canViewOrder, toPublicOrder } from './order-access';
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

  /**
   * The caller's own orders. Requires an identity: without one the answer would
   * be "every guest order", which is nobody's business.
   */
  async myOrders(caller: Caller): Promise<PublicOrder[]> {
    if (!caller.userId) throw new UnauthorizedException('sign in to see your orders');
    return (await this.store.listByCustomer(caller.userId)).map(toPublicOrder);
  }

  /**
   * One order, for its owner or staff. A caller who does not own the order gets
   * the same 404 as a caller asking for an order that does not exist, so the
   * response cannot be used to test whether an id is real.
   */
  async myOrder(id: string, caller: Caller): Promise<PublicOrder> {
    if (!caller.userId && !caller.staff) throw new UnauthorizedException('sign in to track an order');
    const order = await this.store.get(id);
    if (!order || !canViewOrder(order, caller)) throw new NotFoundException(`unknown order ${id}`);
    return toPublicOrder(order);
  }

  /** Cart to order: keep each line's fulfilment, assign the open cycle, total the money. */
  async create(cart: Cart, placedAt: Date = new Date()): Promise<Order> {
    const cycles = await this.cycles.list();
    const order = buildOrder(cart, { id: `ord_${placedAt.getTime()}`, placedAt, cycles });
    return this.store.insert(order);
  }
}
