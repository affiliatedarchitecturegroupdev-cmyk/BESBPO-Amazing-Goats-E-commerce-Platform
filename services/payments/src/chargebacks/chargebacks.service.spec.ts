import { describe, it, expect } from 'vitest';
import { ChargebacksService } from './chargebacks.service';
import { InMemoryChargebacksStore } from './chargebacks.store';
import { PayoutsService } from '../payouts/payouts.service';
import { InMemoryPayoutsStore } from '../payouts/payouts.store';

const NOW = new Date('2026-11-14T08:00:00Z');

function build(payoutStatus: 'approved' | 'paid' = 'approved') {
  const payouts = new PayoutsService(
    new InMemoryPayoutsStore([
      {
        id: 'po_1',
        payeeOrgId: 'org_1',
        amountCents: 300_000,
        requestedBy: 'alice',
        status: payoutStatus,
      },
    ]),
  );
  const service = new ChargebacksService(new InMemoryChargebacksStore(), payouts, () => NOW);
  return { service, payouts };
}

describe('ChargebacksService', () => {
  it('records a chargeback and stamps the received time', async () => {
    const { service } = build();
    const chargeback = await service.receive({
      id: 'cb_1',
      paymentId: 'pay_1',
      payoutId: 'po_1',
      provider: 'stitch',
      amountCents: 300_000,
      reason: 'customer dispute',
    });
    expect(chargeback.status).toBe('received');
    expect(chargeback.receivedAt).toBe(NOW.toISOString());
    expect(await service.list()).toHaveLength(1);
  });

  it('freezes the related payout before the money leaves', async () => {
    const { service, payouts } = build('approved');
    await service.receive({
      id: 'cb_1',
      paymentId: 'pay_1',
      payoutId: 'po_1',
      provider: 'stitch',
      amountCents: 300_000,
      reason: 'customer dispute',
    });
    expect((await payouts.get('po_1')).status).toBe('frozen');
  });

  it('cannot claw back a payout that has already been paid', async () => {
    const { service, payouts } = build('paid');
    await service.receive({
      id: 'cb_1',
      paymentId: 'pay_1',
      payoutId: 'po_1',
      provider: 'stitch',
      amountCents: 300_000,
      reason: 'customer dispute',
    });
    expect((await payouts.get('po_1')).status).toBe('paid');
  });

  it('throws for an unknown chargeback', async () => {
    const { service } = build();
    await expect(service.get('nope')).rejects.toThrow();
  });
});
