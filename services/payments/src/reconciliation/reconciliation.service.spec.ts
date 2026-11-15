import { describe, it, expect } from 'vitest';
import { ReconciliationService } from './reconciliation.service';
import { InMemoryReconciliationStore } from './reconciliation.store';
import { Settlement, SettlementLine } from './reconciliation.types';

const settlement = (over: Partial<Settlement> = {}): Settlement => ({
  id: 'stl_1',
  provider: 'stitch',
  periodStart: '2026-11-10',
  periodEnd: '2026-11-10',
  grossCents: 310_500,
  feesCents: 10_500,
  netCents: 300_000,
  bankRef: 'BANK-1',
  matched: false,
  ...over,
});

const line = (paymentId: string, amountCents: number, settlementId = 'stl_1'): SettlementLine => ({
  settlementId,
  paymentId,
  amountCents,
});

function build(settlements: Settlement[], lines: SettlementLine[], known: string[]) {
  return new ReconciliationService(new InMemoryReconciliationStore(settlements, lines, known));
}

describe('ReconciliationService', () => {
  it('starts empty', async () => {
    expect(await build([], [], []).list()).toEqual([]);
  });

  it('reconciles a settlement and records the outcome', async () => {
    const store = new InMemoryReconciliationStore(
      [settlement()],
      [line('pay_1', 300_000)],
      ['pay_1'],
    );
    const service = new ReconciliationService(store);
    const result = await service.reconcile('stl_1');
    expect(result.matched).toBe(true);
    expect((await service.list())[0].matched).toBe(true);
  });

  it('throws for an unknown settlement', async () => {
    await expect(build([], [], []).reconcile('nope')).rejects.toThrow();
  });

  it('runAll reconciles every settlement', async () => {
    const results = await build(
      [settlement(), settlement({ id: 'stl_2', netCents: 50_000 })],
      [line('pay_1', 300_000), line('pay_2', 50_000, 'stl_2')],
      ['pay_1', 'pay_2'],
    ).runAll();
    expect(results.every((r) => r.matched)).toBe(true);
  });

  it('exceptions lists only the settlements that did not reconcile', async () => {
    const exceptions = await build(
      [settlement(), settlement({ id: 'stl_2', netCents: 50_000 })],
      [line('pay_1', 299_000)],
      ['pay_1'],
    ).exceptions();
    expect(exceptions.map((e) => e.settlementId)).toEqual(['stl_1', 'stl_2']);
  });
});
