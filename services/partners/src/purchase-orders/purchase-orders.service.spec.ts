import { describe, it, expect } from 'vitest';
import { PurchaseOrdersService } from './purchase-orders.service';

describe('PurchaseOrdersService', () => {
  it('starts empty', () => { expect(new PurchaseOrdersService().list()).toEqual([]); });
});
