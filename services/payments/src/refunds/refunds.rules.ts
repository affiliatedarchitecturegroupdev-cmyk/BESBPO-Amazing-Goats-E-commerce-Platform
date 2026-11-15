import {
  MoneyRuleError,
  REFUND_SECOND_APPROVER_LIMIT_CENTS,
  assertSecondApprover,
} from '../money/money.rules';
import { Refund } from './refunds.types';

/**
 * Approve a requested refund. Above the limit a second person must approve, so no
 * one can refund a large sum on their own; below it a single approver is fine.
 */
export function approveRefund(
  refund: Refund,
  approverUserId: string,
  limitCents: number = REFUND_SECOND_APPROVER_LIMIT_CENTS,
): Refund {
  if (refund.status !== 'requested') {
    throw new MoneyRuleError(
      `only a requested refund can be approved, this one is ${refund.status}`,
    );
  }
  if (refund.amountCents <= 0 || !Number.isInteger(refund.amountCents)) {
    throw new MoneyRuleError('a refund amount must be a positive integer number of cents');
  }
  assertSecondApprover(refund, approverUserId, limitCents);
  return { ...refund, status: 'approved', approvedBy: approverUserId };
}

/** Mark an approved refund as paid out by the provider. */
export function markRefunded(refund: Refund): Refund {
  if (refund.status !== 'approved') {
    throw new MoneyRuleError(
      `only an approved refund can be refunded, this one is ${refund.status}`,
    );
  }
  return { ...refund, status: 'refunded' };
}
