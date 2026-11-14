import { describe, it, expect } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { affectedOrders, traceBatch } from './traceability.domain';
import { TraceabilityService } from './traceability.service';
import { InMemoryMovementSource, InMemoryOrderSource } from './traceability.store';
import { InMemoryBatchStore } from '../batches/batches.store';
import { Batch } from '../batches/batches.types';

const batch: Batch = {
  id: 'b1', batchCode: 'AG-20261118-0001', sku: 'AG-LB-001', pack: '1kg',
  halaalCertified: true, temperatureStatus: 'ok', status: 'released',
};
const movements = [
  { batchId: 'b1', kind: 'in', qty: 10, at: '2026-11-18T00:00:00Z' },
  { batchId: 'b2', kind: 'in', qty: 5, at: '2026-11-18T00:00:00Z' },
];
const orders = [
  { id: 'o1', lines: [{ sku: 'AG-LB-001', batchId: 'b1' }] },
  { id: 'o2', lines: [{ sku: 'AG-EG-001' }] },
  { id: 'o3', lines: [{ sku: 'AG-LB-001', batchId: 'b2' }] },
];

describe('traceBatch', () => {
  it('joins a batch to its movements and the orders it supplied', () => {
    const trace = traceBatch(batch, movements, orders);
    expect(trace.movements).toHaveLength(1);
    expect(trace.orders.map((o) => o.id)).toEqual(['o1']);
    expect(trace.orderCount).toBe(1);
  });
});

describe('affectedOrders', () => {
  it('finds every order that took stock from any of the batches', () => {
    expect(affectedOrders(['b1', 'b2'], orders).map((o) => o.id)).toEqual(['o1', 'o3']);
  });
});

describe('TraceabilityService', () => {
  const build = () => new TraceabilityService(
    new InMemoryBatchStore([batch]),
    new InMemoryMovementSource(movements),
    new InMemoryOrderSource(orders),
  );

  it('traces a known batch', async () => {
    const trace = await build().trace('b1');
    expect(trace.batch.batchCode).toBe('AG-20261118-0001');
    expect(trace.orderCount).toBe(1);
  });

  it('404s on an unknown batch', async () => {
    await expect(build().trace('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
