import { describe, it, expect } from 'vitest';
import { BillingService, BILLING_STORE } from './billing.service';
import { InMemoryBillingStore } from './billing.store';

function service() {
  const store = new InMemoryBillingStore();
  return { svc: new BillingService(store), store };
}

describe('BillingService', () => {
  it('starts with a zero balance and an empty ledger', async () => {
    const { svc } = service();
    expect(await svc.balance('org-1')).toBe(0);
    expect(await svc.wallet('org-1')).toEqual({ advertiserOrgId: 'org-1', balanceCents: 0, ledger: [] });
  });

  it('tops up and reports the new balance with a ledger row', async () => {
    const { svc } = service();
    expect(await svc.topUp('org-1', 100_000, 'bank-ref-1')).toBe(100_000);
    const wallet = await svc.wallet('org-1');
    expect(wallet.balanceCents).toBe(100_000);
    expect(wallet.ledger).toHaveLength(1);
    expect(wallet.ledger[0]).toMatchObject({ kind: 'top_up', amountCents: 100_000, ref: 'bank-ref-1' });
  });

  it('spends within funds and writes a negative movement', async () => {
    const { svc } = service();
    await svc.topUp('org-1', 100_000);
    expect(await svc.spend('org-1', 30_000, 'impression-batch')).toBe(70_000);
    const wallet = await svc.wallet('org-1');
    expect(wallet.ledger.map((e) => e.amountCents)).toEqual([100_000, -30_000]);
    expect(wallet.ledger[1]).toMatchObject({ kind: 'spend', ref: 'impression-batch' });
  });

  it('refuses an overspend and writes nothing', async () => {
    const { svc } = service();
    await svc.topUp('org-1', 100_000);
    await expect(svc.spend('org-1', 100_001)).rejects.toThrow(/insufficient funds/);
    expect(await svc.balance('org-1')).toBe(100_000);
    expect((await svc.wallet('org-1')).ledger).toHaveLength(1);
  });

  it('keeps wallets separate per advertiser', async () => {
    const { svc } = service();
    await svc.topUp('org-1', 100_000);
    expect(await svc.balance('org-2')).toBe(0);
  });

  it('exposes the store token for wiring', () => {
    expect(typeof BILLING_STORE).toBe('symbol');
  });
});
