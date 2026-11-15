import { describe, it, expect } from 'vitest';
import {
  MoneyRuleError,
  REFUND_SECOND_APPROVER_LIMIT_CENTS,
  PAYOUT_SECOND_APPROVER_LIMIT_CENTS,
  assertSecondApprover,
  needsSecondApprover,
} from './money.rules';

const request = (amountCents: number, requestedBy = 'alice') => ({
  amountCents,
  requestedBy,
  status: 'refund',
});

describe('money rules', () => {
  it('sets the refund and payout limits as named constants', () => {
    expect(REFUND_SECOND_APPROVER_LIMIT_CENTS).toBe(500_000);
    expect(PAYOUT_SECOND_APPROVER_LIMIT_CENTS).toBe(2_500_000);
  });

  it('only needs a second approver above the limit, not at it', () => {
    expect(
      needsSecondApprover(REFUND_SECOND_APPROVER_LIMIT_CENTS, REFUND_SECOND_APPROVER_LIMIT_CENTS),
    ).toBe(false);
    expect(
      needsSecondApprover(
        REFUND_SECOND_APPROVER_LIMIT_CENTS + 1,
        REFUND_SECOND_APPROVER_LIMIT_CENTS,
      ),
    ).toBe(true);
  });

  it('lets a single approver clear a refund at or below the limit', () => {
    expect(() =>
      assertSecondApprover(
        request(REFUND_SECOND_APPROVER_LIMIT_CENTS),
        'alice',
        REFUND_SECOND_APPROVER_LIMIT_CENTS,
      ),
    ).not.toThrow();
  });

  it('rejects self-approval above the limit', () => {
    expect(() =>
      assertSecondApprover(
        request(REFUND_SECOND_APPROVER_LIMIT_CENTS + 1),
        'alice',
        REFUND_SECOND_APPROVER_LIMIT_CENTS,
      ),
    ).toThrow(MoneyRuleError);
  });

  it('accepts a different approver above the limit', () => {
    expect(() =>
      assertSecondApprover(
        request(REFUND_SECOND_APPROVER_LIMIT_CENTS + 1),
        'bob',
        REFUND_SECOND_APPROVER_LIMIT_CENTS,
      ),
    ).not.toThrow();
  });

  it('requires an approver even below the limit', () => {
    expect(() =>
      assertSecondApprover(request(1_000), '', REFUND_SECOND_APPROVER_LIMIT_CENTS),
    ).toThrow(MoneyRuleError);
  });
});
