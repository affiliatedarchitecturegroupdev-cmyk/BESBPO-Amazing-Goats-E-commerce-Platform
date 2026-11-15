/** Payout states, mirroring payments.payouts.status. */
export type PayoutStatus = 'requested' | 'approved' | 'rejected' | 'paid' | 'frozen';

/** A partner payout, mirroring payments.payouts. Integer cents. */
export interface Payout {
  id: string;
  payeeOrgId: string;
  amountCents: number;
  requestedBy: string;
  approvedBy?: string;
  provider?: string;
  status: PayoutStatus;
  paidAt?: string;
}
