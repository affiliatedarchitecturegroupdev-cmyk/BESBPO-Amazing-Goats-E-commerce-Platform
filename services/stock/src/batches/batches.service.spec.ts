import { describe, it, expect } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { createBatches, formatBatchCode, isSellable, stockOnHand } from './batch-domain';
import { BatchesService } from './batches.service';
import { InMemoryBatchStore } from './batches.store';
import { Batch, BatchInput } from './batches.types';

const input: BatchInput = {
  sku: 'AG-LB-001', pack: '1kg', packedOn: '2026-11-18', sourceOrgId: 'farm-1',
  slaughteredOn: '2026-11-17', useBy: '2026-11-25', grade: 'A', halaalCertified: true,
};

describe('formatBatchCode', () => {
  it('builds AG-<packed date>-<seq>', () => {
    expect(formatBatchCode('2026-11-18', 7)).toBe('AG-20261118-0007');
  });
});

describe('createBatches', () => {
  it('records one batch per pack and lets a pack override weight and grade', () => {
    const batches = createBatches(input, [{ pack: '1kg', grossWeightG: 1050 }, { pack: '500g', grossWeightG: 520, grade: 'B' }]);
    expect(batches).toHaveLength(2);
    expect(batches.map((b) => b.batchCode)).toEqual(['AG-20261118-0001', 'AG-20261118-0002']);
    expect(batches[0].grade).toBe('A');
    expect(batches[1].grade).toBe('B');
    expect(batches[0].status).toBe('quarantine');
    expect(batches[0].halaalCertified).toBe(true);
  });

  it('honours the sequence start for a later intake on the same day', () => {
    expect(createBatches(input, [{ pack: '1kg' }], 5)[0].batchCode).toBe('AG-20261118-0005');
  });
});

describe('isSellable', () => {
  const base: Batch = createBatches(input, [{ pack: '1kg' }])[0];
  it('is true only for released, temperature-ok batches', () => {
    expect(isSellable({ ...base, status: 'released' })).toBe(true);
    expect(isSellable({ ...base, status: 'quarantine' })).toBe(false);
    expect(isSellable({ ...base, status: 'released', temperatureStatus: 'breach' })).toBe(false);
  });
});

describe('stockOnHand', () => {
  it('nets movements in and out', () => {
    const movements = [
      { batchId: 'b1', kind: 'in', qty: 10, at: '2026-11-18T00:00:00Z' },
      { batchId: 'b1', kind: 'out', qty: 4, at: '2026-11-19T00:00:00Z' },
      { batchId: 'b2', kind: 'in', qty: 9, at: '2026-11-18T00:00:00Z' },
    ];
    expect(stockOnHand(movements, 'b1')).toBe(6);
  });
});

describe('BatchesService', () => {
  it('receives packs, releases them and lists sellable stock for a SKU', async () => {
    const service = new BatchesService(new InMemoryBatchStore());
    const received = await service.receive(input, [{ pack: '1kg' }, { pack: '500g' }]);
    expect(received).toHaveLength(2);
    expect(await service.sellable('AG-LB-001')).toHaveLength(0);

    await service.release(received[0].id);
    const sellable = await service.sellable('AG-LB-001');
    expect(sellable.map((b) => b.batchCode)).toEqual(['AG-20261118-0001']);
  });

  it('404s on an unknown batch', async () => {
    const service = new BatchesService(new InMemoryBatchStore());
    await expect(service.get('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
