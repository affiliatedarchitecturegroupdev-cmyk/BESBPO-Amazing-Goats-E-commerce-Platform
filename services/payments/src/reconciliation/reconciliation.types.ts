/** A provider settlement, mirroring payments.settlements. Integer cents. */
export interface Settlement {
  id: string;
  provider: string;
  periodStart: string;
  periodEnd: string;
  grossCents: number;
  feesCents: number;
  netCents: number;
  bankRef: string;
  matched: boolean;
}

/** One payment covered by a settlement, mirroring payments.settlement_lines. */
export interface SettlementLine {
  settlementId: string;
  paymentId: string;
  amountCents: number;
}
