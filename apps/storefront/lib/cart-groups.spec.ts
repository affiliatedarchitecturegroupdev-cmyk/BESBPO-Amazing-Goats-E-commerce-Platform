import { describe, it, expect } from 'vitest';
import { groupByFulfilment, deliveryLine, GROUP_ORDER } from './cart-groups';
import type { CartLine } from './cart';

const line = (over: Partial<CartLine> = {}): CartLine => ({
  sku: 'AG-LM-001', name: 'Full lamb box', qty: 1, unitPriceExVatCents: 10000,
  fulfilment: 'pre_order_cycle', temperature: 'chilled', ...over,
});

describe('groupByFulfilment', () => {
  it('groups lines by how they travel, in the fixed order', () => {
    const groups = groupByFulfilment([
      line({ sku: 'live', temperature: 'live' }),
      line({ sku: 'ambient', temperature: 'ambient' }),
      line({ sku: 'chilled', temperature: 'chilled' }),
    ]);
    expect(groups.map((g) => g.temperature)).toEqual(['chilled', 'ambient', 'live']);
  });

  it('omits empty groups and totals each group', () => {
    const groups = groupByFulfilment([line({ qty: 2, unitPriceExVatCents: 5000 })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].subtotalExVatCents).toBe(10000);
  });

  it('notes that live reservations are paid as a deposit', () => {
    const groups = groupByFulfilment([line({ temperature: 'live' })]);
    expect(groups[0].heading).toBe('Live animals');
    expect(groups[0].note).toContain('deposit');
  });

  it('keeps the documented group order stable', () => {
    expect(GROUP_ORDER).toEqual(['chilled', 'frozen', 'ambient', 'live']);
  });
});

describe('deliveryLine', () => {
  it('labels zone 1 as free on route days and names other zones', () => {
    expect(deliveryLine(1, 0).label).toContain('free on route days');
    expect(deliveryLine(2, 6500)).toEqual({ label: 'Delivery (zone 2)', feeCents: 6500 });
    expect(deliveryLine(undefined, 0).label).toContain('—');
  });
});
