import { describe, it, expect } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { assignCycle, buildOrder, roundCents, toOrderLines } from './order-builder';
import { OrdersService } from './orders.service';
import { InMemoryOrderStore } from './orders.store';
import { Cart } from './orders.types';
import { CycleRecord } from '../cycles/cycle-engine';

const NOW = new Date('2026-11-11T10:00:00Z');
const THIS_WEEK: CycleRecord = {
  id: 'chilled_meat:2026-11-15T15:00:00.000Z', productClass: 'chilled_meat',
  cutoffAt: '2026-11-15T15:00:00.000Z', deliveryFrom: '2026-11-18T04:00:00.000Z', deliveryTo: '2026-11-20T16:00:00.000Z', status: 'open',
};
const NEXT_WEEK: CycleRecord = { ...THIS_WEEK, id: 'chilled_meat:2026-11-22T15:00:00.000Z', cutoffAt: '2026-11-22T15:00:00.000Z' };

const cart: Cart = {
  lines: [
    { sku: 'AG-LB-001', qty: 2, unitPriceExVatCents: 45_000, fulfilment: 'pre_order_cycle', temperature: 'chilled' },
    { sku: 'AG-EG-001', qty: 1, unitPriceExVatCents: 3_500, fulfilment: 'in_stock', temperature: 'ambient' },
  ],
  deliveryFeeCents: 6_500,
  paymentMethod: 'card',
};

describe('roundCents', () => {
  it('rounds half up to whole cents', () => {
    expect(roundCents(10.5)).toBe(11);
    expect(roundCents(10.4)).toBe(10);
  });
});

describe('toOrderLines', () => {
  it('keeps the fulfilment type and drops zero quantities', () => {
    const lines = toOrderLines({ lines: [...cart.lines, { sku: 'X', qty: 0, unitPriceExVatCents: 1, fulfilment: 'in_stock', temperature: 'ambient' }] });
    expect(lines).toHaveLength(2);
    expect(lines[0].fulfilment).toBe('pre_order_cycle');
  });
});

describe('assignCycle', () => {
  it('takes the soonest open cycle', () => {
    expect(assignCycle([{ fulfilment: 'pre_order_cycle' }], [NEXT_WEEK, THIS_WEEK], NOW)?.id).toBe(THIS_WEEK.id);
  });
  it('rolls a late order to the next cycle after the cut-off', () => {
    const after = new Date('2026-11-15T16:00:00Z');
    expect(assignCycle([{ fulfilment: 'pre_order_cycle' }], [THIS_WEEK, NEXT_WEEK], after)?.id).toBe(NEXT_WEEK.id);
  });
  it('ignores closed cycles', () => {
    expect(assignCycle([{ fulfilment: 'pre_order_cycle' }], [{ ...THIS_WEEK, status: 'closed' }], NOW)).toBeNull();
  });
  it('returns null when no line needs a cycle', () => {
    expect(assignCycle([{ fulfilment: 'in_stock' }], [THIS_WEEK], NOW)).toBeNull();
  });
});

describe('buildOrder', () => {
  it('keeps fulfilment per line, assigns the cycle and totals money with VAT on goods only', () => {
    const order = buildOrder(cart, { id: 'o1', placedAt: NOW, cycles: [THIS_WEEK] });
    expect(order.lines.map((l) => l.fulfilment)).toEqual(['pre_order_cycle', 'in_stock']);
    expect(order.cycleId).toBe(THIS_WEEK.id);
    expect(order.subtotalExVatCents).toBe(93_500);
    expect(order.vatCents).toBe(14_025); // 15% of 93 500
    expect(order.totalIncVatCents).toBe(114_025); // goods + VAT + 6 500 delivery
    expect(order.status).toBe('pending_payment');
  });

  it('leaves cycleId null for an in-stock-only cart', () => {
    const order = buildOrder({ lines: [cart.lines[1]] }, { id: 'o2', placedAt: NOW });
    expect(order.cycleId).toBeNull();
  });

  it('refuses a cycle-required cart with no open cycle', () => {
    expect(() => buildOrder({ lines: [cart.lines[0]] }, { id: 'o3', placedAt: NOW, cycles: [] })).toThrow(/no open cycle/);
  });

  it('refuses an empty cart', () => {
    expect(() => buildOrder({ lines: [] }, { id: 'o4', placedAt: NOW })).toThrow(/empty/);
  });
});

describe('OrdersService', () => {
  const cycles = { list: async () => [THIS_WEEK, NEXT_WEEK] };

  it('creates an order, keeps it and reads it back', async () => {
    const service = new OrdersService(new InMemoryOrderStore(), cycles);
    const order = await service.create(cart, NOW);
    expect(order.cycleId).toBe(THIS_WEEK.id);
    expect((await service.get(order.id)).id).toBe(order.id);
    expect(await service.list()).toHaveLength(1);
  });

  it('404s on an unknown order', async () => {
    const service = new OrdersService(new InMemoryOrderStore(), cycles);
    await expect(service.get('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
