import { describe, it, expect } from 'vitest';
import { buildDayPack, stopFromOrder } from './gateway';
import type { Order } from '@ag/api-client';

const order: Order = {
  id: 'o-1',
  status: 'confirmed',
  subtotalExVatCents: 1000,
  vatCents: 150,
  totalIncVatCents: 1150,
  createdAt: '2026-11-18T06:05:00Z',
  deliveryAddress: { line1: '1 Long St', suburb: 'CBD', city: 'Durban', postalCode: '4001' },
  lines: [{ sku: 'AG-LM-001', qty: 2, unitPriceExVatCents: 1000, fulfilment: 'in_stock', temperature: 'chilled' }],
};

describe('stopFromOrder', () => {
  it('builds a stop from the order address, window and lines', () => {
    const stop = stopFromOrder(order, 1);
    expect(stop.id).toBe('o-1');
    expect(stop.sequence).toBe(1);
    expect(stop.customer).toBe('Durban');
    expect(stop.address).toBe('1 Long St, CBD, Durban');
    expect(stop.window).toBe('06:05');
    expect(stop.items).toEqual([{ name: 'AG-LM-001', qty: 2 }]);
  });

  it('copes with an order that has no address or lines', () => {
    const stop = stopFromOrder({ ...order, deliveryAddress: undefined, lines: undefined, createdAt: undefined }, 2);
    expect(stop.address).toBe('No address on file');
    expect(stop.window).toBe('—');
    expect(stop.items).toEqual([]);
  });
});

describe('buildDayPack', () => {
  it('numbers the stops in order and stamps the download time', () => {
    const pack = buildDayPack('Wed Durban', [order, { ...order, id: 'o-2' }], new Date('2026-11-18T05:40:00Z'));
    expect(pack.routeName).toBe('Wed Durban');
    expect(pack.downloadedAt).toBe('2026-11-18T05:40:00.000Z');
    expect(pack.stops.map((s) => s.sequence)).toEqual([1, 2]);
  });
});
