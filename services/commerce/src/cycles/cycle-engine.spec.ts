import { describe, it, expect } from 'vitest';
import {
  buildPickList,
  buildPurchaseOrders,
  cyclesToGenerate,
  generateCycle,
  isDueToClose,
  runCycleTick,
} from './cycle-engine';
import { InMemoryCycleStore } from './cycle.store';

const NOW = new Date('2026-11-11T10:00:00Z'); // Wednesday
const CUTOFF = '2026-11-15T15:00:00.000Z'; // Sunday 17:00 SAST

describe('generateCycle', () => {
  it('schedules the coming chilled-meat cycle', () => {
    const c = generateCycle(NOW);
    expect(c.id).toBe(`chilled_meat:${CUTOFF}`);
    expect(c.productClass).toBe('chilled_meat');
    expect(c.cutoffAt).toBe(CUTOFF);
    expect(c.tradeLockAt).toBe('2026-11-15T10:00:00.000Z');
    expect(c.status).toBe('scheduled');
  });
});

describe('cyclesToGenerate', () => {
  it('generates one cycle when none is upcoming', () => {
    expect(cyclesToGenerate([], NOW)).toHaveLength(1);
  });
  it('does nothing when a future cycle already exists', () => {
    expect(cyclesToGenerate([generateCycle(NOW)], NOW)).toEqual([]);
  });
});

describe('isDueToClose', () => {
  it('is true only once the cut-off has passed and the cycle is open', () => {
    const open = { ...generateCycle(NOW), status: 'open' as const };
    expect(isDueToClose(open, new Date('2026-11-15T14:59:00Z'))).toBe(false);
    expect(isDueToClose(open, new Date('2026-11-15T15:00:00Z'))).toBe(true);
    expect(isDueToClose({ ...open, status: 'closed' }, new Date('2026-11-15T16:00:00Z'))).toBe(false);
  });
});

describe('buildPickList', () => {
  it('sums quantities by SKU and sorts by quantity then SKU', () => {
    const pick = buildPickList('c1', [
      { id: 'o1', lines: [{ sku: 'AG-LG-001', qty: 2 }, { sku: 'AG-EG-001', qty: 5 }] },
      { id: 'o2', lines: [{ sku: 'AG-LG-001', qty: 3 }, { sku: 'AG-PK-001', qty: 1 }] },
    ]);
    expect(pick.lines).toEqual([
      { sku: 'AG-EG-001', qty: 5 },
      { sku: 'AG-LG-001', qty: 5 },
      { sku: 'AG-PK-001', qty: 1 },
    ]);
    expect(pick.totalUnits).toBe(11);
  });
});

describe('buildPurchaseOrders', () => {
  it('drafts one order per supplier kind', () => {
    const pos = buildPurchaseOrders('c1', [{ sku: 'AG-LG-001', qty: 5 }]);
    expect(pos.map((p) => p.kind)).toEqual(['abattoir', 'farm']);
    expect(pos.every((p) => p.status === 'draft' && p.lines.length === 1)).toBe(true);
  });
});

describe('runCycleTick', () => {
  it('generates and opens a cycle, then closes it with a pick list and purchase orders', async () => {
    const store = new InMemoryCycleStore();
    const first = await runCycleTick(store, NOW);
    expect(first.generated).toEqual([`chilled_meat:${CUTOFF}`]);
    expect(first.opened).toEqual([`chilled_meat:${CUTOFF}`]);
    expect((await store.get(`chilled_meat:${CUTOFF}`))?.status).toBe('open');

    const withOrders = new InMemoryCycleStore(
      [{ ...generateCycle(NOW), status: 'open' }],
      { [`chilled_meat:${CUTOFF}`]: [{ id: 'o1', lines: [{ sku: 'AG-LG-001', qty: 4 }] }] },
    );
    const second = await runCycleTick(withOrders, new Date('2026-11-15T16:00:00Z'));
    expect(second.closed).toEqual([`chilled_meat:${CUTOFF}`]);
    expect(second.generated).toEqual(['chilled_meat:2026-11-22T15:00:00.000Z']); // rolled to the next week
    expect(withOrders.pickLists[0].totalUnits).toBe(4);
    expect(withOrders.purchaseOrders.map((p) => p.kind)).toEqual(['abattoir', 'farm']);
  });
});
