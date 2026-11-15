/** Refund states, mirroring payments.refunds.status. */
export type RefundStatus = 'requested' | 'approved' | 'rejected' | 'refunded';

/** A refund request, mirroring payments.refunds. Integer cents. */
export interface Refund {
  id: string;
  paymentId: string;
  amountCents: number;
  reason: string;
  requestedBy: string;
  approvedBy?: string;
  status: RefundStatus;
}
