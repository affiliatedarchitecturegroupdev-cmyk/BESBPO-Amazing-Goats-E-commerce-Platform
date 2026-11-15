/** Chargeback states, mirroring the chargeback lifecycle. */
export type ChargebackStatus = 'received' | 'accepted' | 'reversed';

/** A chargeback raised by a provider against a payment, with the payout it claws back. */
export interface Chargeback {
  id: string;
  paymentId: string;
  payoutId: string;
  provider: string;
  amountCents: number;
  reason: string;
  status: ChargebackStatus;
  receivedAt: string;
}
