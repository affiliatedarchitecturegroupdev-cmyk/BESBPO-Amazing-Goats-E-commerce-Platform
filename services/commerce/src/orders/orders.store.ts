import type { OrderStatus } from '@ag/shared-types';
import { Order } from './orders.types';

/** Persistence boundary for orders; the SQL adapter lands with the orders store swap. */
export interface OrderStore {
  list(): Promise<Order[]>;
  get(id: string): Promise<Order | undefined>;
  insert(order: Order): Promise<Order>;
  updateStatus(id: string, status: OrderStatus): Promise<void>;
}

/** In-memory order store used by tests and local runs until the SQL adapter is wired. */
export class InMemoryOrderStore implements OrderStore {
  private readonly byId = new Map<string, Order>();

  constructor(seed: Order[] = []) {
    for (const order of seed) this.byId.set(order.id, order);
  }

  async list(): Promise<Order[]> {
    return [...this.byId.values()];
  }

  async get(id: string): Promise<Order | undefined> {
    return this.byId.get(id);
  }

  async insert(order: Order): Promise<Order> {
    this.byId.set(order.id, order);
    return order;
  }

  async updateStatus(id: string, status: OrderStatus): Promise<void> {
    const order = this.byId.get(id);
    if (order) this.byId.set(id, { ...order, status });
  }
}
