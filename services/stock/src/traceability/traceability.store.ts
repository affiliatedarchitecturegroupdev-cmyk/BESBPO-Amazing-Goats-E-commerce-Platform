import { OrderRef, StockMovement } from '../batches/batches.types';
import { MovementSource, OrderSource } from './traceability.service';

/** In-memory movement and order sources used until the SQL adapters are wired. */
export class InMemoryMovementSource implements MovementSource {
  constructor(private readonly movements: StockMovement[] = []) {}
  async list(): Promise<StockMovement[]> {
    return this.movements;
  }
}

export class InMemoryOrderSource implements OrderSource {
  constructor(private readonly orders: OrderRef[] = []) {}
  async list(): Promise<OrderRef[]> {
    return this.orders;
  }
}
