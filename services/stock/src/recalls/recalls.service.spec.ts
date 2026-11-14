import { describe, it, expect } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { openRecall, planRecall } from './recalls.domain';
import { RecallsService } from './recalls.service';
import { InMemoryRecallStore } from './recalls.store';
import { InMemoryBatchStore } from '../batches/batches.store';
import { InMemoryOrderSource } from '../traceability/traceability.store';
import { Batch } from '../batches/batches.types';

const batch: Batch = {
  id: 'b1', batchCode: 'AG-20261118-0001', sku: 'AG-LB-001', pack: '1kg',
  halaalCertified: true, temperatureStatus: 'ok', status: 'released',
};
const orders = [
  { id: 'o1', lines: [{ sku: 'AG-LB-001', batchId: 'b1' }] },
  { id: 'o2', lines: [{ sku: 'AG-LB-001', batchId: 'b1' }] },
  { id: 'o3', lines: [{ sku: 'AG-EG-001', batchId: 'b9' }] },
];

describe('planRecall', () => {
  it('withdraws from customers when stock has shipped', () => {
    const plan = planRecall('b1', orders);
    expect(plan.affectedOrderIds).toEqual(['o1', 'o2']);
    expect(plan.notifyCustomer).toBe(true);
    expect(plan.action).toBe('withdraw_from_customers');
  });

  it('just blocks stock when nothing shipped', () => {
    const plan = planRecall('b9', [{ id: 'o9', lines: [{ sku: 'X', batchId: 'b1' }] }]);
    expect(plan.affectedOrderIds).toEqual([]);
    expect(plan.notifyCustomer).toBe(false);
    expect(plan.action).toBe('block_stock');
  });
});

describe('openRecall', () => {
  it('records the affected orders', () => {
    const recall = openRecall('rec_1', { batchId: 'b1', reason: 'listeria', openedBy: 'u1' }, orders, new Date('2026-11-20T08:00:00Z'));
    expect(recall.affectedOrderIds).toEqual(['o1', 'o2']);
    expect(recall.openedAt).toBe('2026-11-20T08:00:00.000Z');
    expect(recall.closedAt).toBeUndefined();
  });
});

describe('RecallsService', () => {
  const build = () => new RecallsService(new InMemoryRecallStore(), new InMemoryBatchStore([batch]), new InMemoryOrderSource(orders));

  it('finds all affected orders and blocks the batch on open', async () => {
    const service = build();
    const recall = await service.open({ batchId: 'b1', reason: 'listeria', openedBy: 'u1' }, new Date('2026-11-20T08:00:00Z'));
    expect(recall.affectedOrderIds).toEqual(['o1', 'o2']);
    expect(await service.list()).toHaveLength(1);
  });

  it('plans without opening', async () => {
    const service = build();
    const plan = await service.plan('b1');
    expect(plan.affectedOrderIds).toEqual(['o1', 'o2']);
    expect(await service.list()).toHaveLength(0);
  });

  it('closes a recall and 404s on unknown ids', async () => {
    const service = build();
    const recall = await service.open({ batchId: 'b1', reason: 'listeria', openedBy: 'u1' });
    const closed = await service.close(recall.id, new Date('2026-11-21T08:00:00Z'));
    expect(closed.closedAt).toBe('2026-11-21T08:00:00.000Z');
    await expect(service.get('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
