import {
  MoneyRuleError,
  PAYOUT_SECOND_APPROVER_LIMIT_CENTS,
  assertSecondApprover,
} from '../money/money.rules';
import { Payout } from './payouts.types';

/**
 * Approve a requested payout. Above the limit a second person must approve, so no
 * one can move a large sum to a payee on their own; below it a single approver is fine.
 */
export function approvePayout(
  payout: Payout,
  approverUserId: string,
  limitCents: number = PAYOUT_SECOND_APPROVER_LIMIT_CENTS,
): Payout {
  if (payout.status !== 'requested') {
    throw new MoneyRuleError(
      `only a requested payout can be approved, this one is ${payout.status}`,
    );
  }
  if (payout.amountCents <= 0 || !Number.isInteger(payout.amountCents)) {
    throw new MoneyRuleError('a payout amount must be a positive integer number of cents');
  }
  assertSecondApprover(payout, approverUserId, limitCents);
  return { ...payout, status: 'approved', approvedBy: approverUserId };
}

/** Mark an approved payout as paid by the provider. */
export function markPaid(payout: Payout, at: Date): Payout {
  if (payout.status !== 'approved') {
    throw new MoneyRuleError(`only an approved payout can be paid, this one is ${payout.status}`);
  }
  return { ...payout, status: 'paid', paidAt: at.toISOString() };
}

/**
 * Freeze a payout that a chargeback has called into question. A paid payout cannot
 * be frozen (the money has left), so only an un-settled one is held.
 */
export function freezePayout(payout: Payout): Payout {
  if (payout.status === 'paid' || payout.status === 'frozen') return payout;
  return { ...payout, status: 'frozen' };
}
