import { describe, it, expect } from 'vitest';
import { PayoutsService } from './payouts.service';
import { InMemoryPayoutsStore } from './payouts.store';

function build() {
  return new PayoutsService(new InMemoryPayoutsStore());
}

describe('PayoutsService', () => {
  it('starts empty', async () => {
    expect(await build().list()).toEqual([]);
  });

  it('records a request as requested', async () => {
    const service = build();
    const payout = await service.request({
      id: 'po_1',
      payeeOrgId: 'org_1',
      amountCents: 1_000_000,
      requestedBy: 'alice',
    });
    expect(payout.status).toBe('requested');
  });

  it('refuses self-approval above the limit', async () => {
    const service = build();
    await service.request({
      id: 'po_1',
      payeeOrgId: 'org_1',
      amountCents: 9_000_000,
      requestedBy: 'alice',
    });
    await expect(service.approve('po_1', 'alice')).rejects.toThrow();
  });

  it('approves and pays a payout with a second approver', async () => {
    const service = build();
    await service.request({
      id: 'po_1',
      payeeOrgId: 'org_1',
      amountCents: 9_000_000,
      requestedBy: 'alice',
    });
    await service.approve('po_1', 'bob');
    expect((await service.markPaid('po_1')).status).toBe('paid');
  });

  it('throws for an unknown payout', async () => {
    await expect(build().get('nope')).rejects.toThrow();
  });
});
