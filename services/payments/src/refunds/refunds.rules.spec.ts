import { describe, it, expect } from 'vitest';
import { MoneyRuleError } from '../money/money.rules';
import { approveRefund, markRefunded } from './refunds.rules';
import { Refund } from './refunds.types';

const refund = (over: Partial<Refund> = {}): Refund => ({
  id: 'ref_1',
  paymentId: 'pay_1',
  amountCents: 100_000,
  reason: 'damaged box',
  requestedBy: 'alice',
  status: 'requested',
  ...over,
});

describe('approveRefund', () => {
  it('lets a single approver clear a small refund', () => {
    const approved = approveRefund(refund(), 'bob');
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe('bob');
  });

  it('rejects self-approval above the limit', () => {
    expect(() => approveRefund(refund({ amountCents: 500_001 }), 'alice')).toThrow(MoneyRuleError);
  });

  it('accepts a different approver above the limit', () => {
    expect(approveRefund(refund({ amountCents: 500_001 }), 'bob').approvedBy).toBe('bob');
  });

  it('only approves a requested refund', () => {
    expect(() => approveRefund(refund({ status: 'approved' }), 'bob')).toThrow(MoneyRuleError);
  });

  it('rejects a non-positive amount', () => {
    expect(() => approveRefund(refund({ amountCents: 0 }), 'bob')).toThrow(MoneyRuleError);
  });
});

describe('markRefunded', () => {
  it('pays out an approved refund', () => {
    expect(markRefunded(refund({ status: 'approved' })).status).toBe('refunded');
  });
  it('refuses to pay an unapproved refund', () => {
    expect(() => markRefunded(refund())).toThrow(MoneyRuleError);
  });
});
