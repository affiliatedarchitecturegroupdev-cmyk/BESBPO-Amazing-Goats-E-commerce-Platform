import { describe, it, expect } from 'vitest';
import { RefundsService } from './refunds.service';
import { InMemoryRefundsStore } from './refunds.store';

function build() {
  return new RefundsService(new InMemoryRefundsStore());
}

describe('RefundsService', () => {
  it('starts empty', async () => {
    expect(await build().list()).toEqual([]);
  });

  it('records a request as requested', async () => {
    const service = build();
    const refund = await service.request({
      id: 'ref_1',
      paymentId: 'pay_1',
      amountCents: 100_000,
      reason: 'damaged',
      requestedBy: 'alice',
    });
    expect(refund.status).toBe('requested');
  });

  it('approves a small refund with one approver', async () => {
    const service = build();
    await service.request({
      id: 'ref_1',
      paymentId: 'pay_1',
      amountCents: 100_000,
      reason: 'x',
      requestedBy: 'alice',
    });
    expect((await service.approve('ref_1', 'bob')).status).toBe('approved');
  });

  it('refuses self-approval above the limit', async () => {
    const service = build();
    await service.request({
      id: 'ref_1',
      paymentId: 'pay_1',
      amountCents: 900_000,
      reason: 'x',
      requestedBy: 'alice',
    });
    await expect(service.approve('ref_1', 'alice')).rejects.toThrow();
  });

  it('throws for an unknown refund', async () => {
    await expect(build().get('nope')).rejects.toThrow();
  });
});
