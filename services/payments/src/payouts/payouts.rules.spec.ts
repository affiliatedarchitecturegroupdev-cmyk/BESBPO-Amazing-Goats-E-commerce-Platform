import { describe, it, expect } from 'vitest';
import { MoneyRuleError } from '../money/money.rules';
import { approvePayout, freezePayout, markPaid } from './payouts.rules';
import { Payout } from './payouts.types';

const payout = (over: Partial<Payout> = {}): Payout => ({
  id: 'po_1',
  payeeOrgId: 'org_1',
  amountCents: 1_000_000,
  requestedBy: 'alice',
  status: 'requested',
  ...over,
});

describe('approvePayout', () => {
  it('lets a single approver clear a payout at or below the limit', () => {
    const approved = approvePayout(payout({ amountCents: 2_500_000 }), 'alice');
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe('alice');
  });

  it('rejects self-approval above the limit', () => {
    expect(() => approvePayout(payout({ amountCents: 2_500_001 }), 'alice')).toThrow(
      MoneyRuleError,
    );
  });

  it('accepts a different approver above the limit', () => {
    expect(approvePayout(payout({ amountCents: 2_500_001 }), 'bob').approvedBy).toBe('bob');
  });

  it('only approves a requested payout', () => {
    expect(() => approvePayout(payout({ status: 'paid' }), 'bob')).toThrow(MoneyRuleError);
  });
});

describe('markPaid', () => {
  it('stamps the paid time on an approved payout', () => {
    const at = new Date('2026-11-14T08:00:00Z');
    expect(markPaid(payout({ status: 'approved' }), at).paidAt).toBe(at.toISOString());
  });
  it('refuses to pay an unapproved payout', () => {
    expect(() => markPaid(payout(), new Date())).toThrow(MoneyRuleError);
  });
});

describe('freezePayout', () => {
  it('holds an un-settled payout', () => {
    expect(freezePayout(payout({ status: 'approved' })).status).toBe('frozen');
  });
  it('leaves an already paid payout alone', () => {
    expect(freezePayout(payout({ status: 'paid' })).status).toBe('paid');
  });
  it('is a no-op on an already frozen payout', () => {
    expect(freezePayout(payout({ status: 'frozen' })).status).toBe('frozen');
  });
});
