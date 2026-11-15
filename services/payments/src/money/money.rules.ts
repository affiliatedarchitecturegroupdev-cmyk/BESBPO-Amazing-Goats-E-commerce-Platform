/**
 * Money movement rules shared by refunds, payouts and chargebacks. The limits are
 * named constants, not literals, because they are the threshold at which a second
 * person must approve a payment out.
 */

/** Above this, a refund needs a second approver (four-eyes). R5,000. */
export const REFUND_SECOND_APPROVER_LIMIT_CENTS = 500_000;

/** Above this, a payout needs a second approver. R25,000. */
export const PAYOUT_SECOND_APPROVER_LIMIT_CENTS = 2_500_000;

/** Raised when a money-movement transition is not allowed. */
export class MoneyRuleError extends Error {}

export interface Approvable {
  amountCents: number;
  requestedBy: string;
  approvedBy?: string;
  status: string;
}

/** Above the limit, a second person must approve; at or below it, one approver is enough. */
export function needsSecondApprover(amountCents: number, limitCents: number): boolean {
  return amountCents > limitCents;
}

/**
 * Decide whether `approverUserId` may approve this request. Below the limit any
 * approver is fine. Above it the approver must differ from the requester, so no
 * one can move a large sum of money on their own. Throws on a violation rather
 * than returning a flag, so a caller cannot forget to check it.
 */
export function assertSecondApprover(
  request: Approvable,
  approverUserId: string,
  limitCents: number,
): void {
  if (!approverUserId) throw new MoneyRuleError('an approver is required');
  if (!needsSecondApprover(request.amountCents, limitCents)) return;
  if (request.requestedBy === approverUserId) {
    throw new MoneyRuleError(
      `a ${request.status} above the limit needs a second approver: the approver must not be the requester`,
    );
  }
}
