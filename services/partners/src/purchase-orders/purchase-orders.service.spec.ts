import { describe, it, expect } from 'vitest';
import { PurchaseOrdersService } from './purchase-orders.service';
import { InMemoryPartnerStore } from '../partner.store';
import type { PurchaseOrder } from '../partner-domain';

const po = (over: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  id: 'po-1',
  orgId: 'org-1',
  code: 'PO-118',
  description: '200 broilers',
  date: 'Wed',
  status: 'sent',
  ...over,
});

const service = (seed: PurchaseOrder[]) => new PurchaseOrdersService(new InMemoryPartnerStore({ purchaseOrders: seed }));

describe('PurchaseOrdersService', () => {
  it('lists only the org’s own purchase orders', async () => {
    const svc = service([po(), po({ id: 'po-2', orgId: 'org-2', code: 'PO-200' })]);
    const rows = await svc.list('org-1');
    expect(rows.map((r) => r.code)).toEqual(['PO-118']);
  });

  it('returns nothing when the org has no orders', async () => {
    expect(await service([po()]).list('org-9')).toEqual([]);
  });
});
