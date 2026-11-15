import { Settlement, SettlementLine } from './reconciliation.types';

/** Why a settlement did not reconcile against the bank and the payments it covers. */
export type MismatchReason = 'no_lines' | 'lines_do_not_sum_to_net' | 'unknown_payment';

export interface SettlementMatch {
  settlementId: string;
  matched: boolean;
  issues: MismatchReason[];
  lineTotalCents: number;
}

/**
 * Match one provider settlement to the payments it covers. It reconciles only
 * when every line resolves to a known payment and the lines sum exactly to the
 * settlement's net. A mismatch is reported, never thrown: reconciliation is a
 * nightly batch, and one bad settlement must not stop the rest.
 */
export function reconcileSettlement(
  settlement: Settlement,
  lines: SettlementLine[],
  knownPaymentIds: ReadonlySet<string>,
): SettlementMatch {
  const mine = lines.filter((l) => l.settlementId === settlement.id);
  const issues: MismatchReason[] = [];
  const lineTotalCents = mine.reduce((sum, l) => sum + l.amountCents, 0);

  if (mine.length === 0) issues.push('no_lines');
  if (lineTotalCents !== settlement.netCents) issues.push('lines_do_not_sum_to_net');
  if (mine.some((l) => !knownPaymentIds.has(l.paymentId))) issues.push('unknown_payment');

  return { settlementId: settlement.id, matched: issues.length === 0, issues, lineTotalCents };
}

/** Reconcile a batch of settlements, returning one result per settlement in order. */
export function reconcileAll(
  settlements: Settlement[],
  lines: SettlementLine[],
  knownPaymentIds: ReadonlySet<string>,
): SettlementMatch[] {
  return settlements.map((s) => reconcileSettlement(s, lines, knownPaymentIds));
}
