export type Tier = 'new' | 'probation' | 'standard' | 'preferred';
export interface TierInput {
  currentTier: Tier; completedOrders: number; monthsClean: number; onTimeRate: number;
  avgWeeklySpendCents: number; maxDaysPastDue: number; bureauRisk: 'low' | 'medium' | 'high';
  entityType: 'company' | 'sole_proprietor' | 'other'; turnoverDeclaredCents: number | null;
}
export interface TierResult { tier: Tier; termsDays: number; limitCents: number; reasons: string[]; ncaReview: boolean; needsApproval: boolean }

const ORDER: Tier[] = ['new', 'probation', 'standard', 'preferred'];
const TERMS: Record<Tier, number> = { new: 0, probation: 7, standard: 14, preferred: 30 };
const WEEKS: Record<Tier, number> = { new: 0, probation: 1, standard: 2, preferred: 4 };
export const NCA_TURNOVER_THRESHOLD_CENTS = 100_000_000; // R1,000,000: below this, credit may fall inside the National Credit Act

/** Credit is earned and reviewed monthly. A person approves; this function only proposes. */
export function evaluateTier(i: TierInput, approvalLimitCents = 10_000_000): TierResult {
  const reasons: string[] = [];
  let idx = ORDER.indexOf(i.currentTier);
  const ncaReview = i.entityType === 'sole_proprietor' || i.turnoverDeclaredCents === null || i.turnoverDeclaredCents < NCA_TURNOVER_THRESHOLD_CENTS;

  if (i.maxDaysPastDue >= 30) { idx = 0; reasons.push('30+ days past due: back to prepay'); }
  else if (i.maxDaysPastDue >= 14) { idx = Math.max(0, idx - 1); reasons.push('14+ days past due: dropped one tier'); }
  else if (i.maxDaysPastDue <= 0) {
    if (idx === 0 && i.completedOrders >= 3) { idx = 1; reasons.push('3 prepaid orders completed'); }
    else if (idx === 1 && i.monthsClean >= 3 && i.onTimeRate >= 0.95) { idx = 2; reasons.push('3 clean months'); }
    else if (idx === 2 && i.monthsClean >= 6 && i.onTimeRate >= 0.98) { idx = 3; reasons.push('6 clean months'); }
  }
  if (i.bureauRisk === 'high') { idx = 0; reasons.push('bureau risk high: prepay only'); }
  else if (i.bureauRisk === 'medium' && idx > 2) { idx = 2; reasons.push('bureau risk medium: capped at standard'); }
  if (ncaReview && idx > 1) { idx = 1; reasons.push('NCA review pending: capped at probation'); }

  const tier = ORDER[idx];
  const limitCents = i.avgWeeklySpendCents * WEEKS[tier];
  return { tier, termsDays: TERMS[tier], limitCents, reasons, ncaReview, needsApproval: limitCents > approvalLimitCents };
}
