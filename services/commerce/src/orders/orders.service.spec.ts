import { describe, it, expect } from 'vitest';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  it('starts empty', () => { expect(new OrdersService().list()).toEqual([]); });
});
