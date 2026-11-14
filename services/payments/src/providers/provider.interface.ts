import type { Method, Provider } from '../routing/route-payment';

/** What the platform asks a provider to do, in provider-neutral terms. */
export interface PaymentIntentRequest {
  intentId: string;
  amountCents: number; // inc VAT, integer cents, ZAR
  currency: 'ZAR';
  method: Method;
  /** Human-readable reference shown on the customer's statement. */
  reference: string;
  /** Sent to the provider so a retry of the same intent is not charged twice. */
  idempotencyKey: string;
  returnUrl?: string;
  notifyUrl?: string;
  customer?: { name?: string; email?: string; phone?: string };
}

export type ProviderPaymentStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled';

export interface PaymentResult {
  providerRef: string;
  status: ProviderPaymentStatus;
  /** Where to send the customer for hosted fields or a redirect. */
  redirectUrl?: string;
}

export interface RefundRequest {
  paymentRef: string;
  amountCents: number;
  reason?: string;
  idempotencyKey: string;
}

export interface RefundResult {
  refundRef: string;
  status: ProviderPaymentStatus;
}

/** A verified, normalised webhook event. */
export interface WebhookEvent {
  id: string;
  type: string;
  providerRef: string;
  status: ProviderPaymentStatus;
  amountCents?: number;
  occurredAt?: string;
}

export interface WebhookInput {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
}

/**
 * The one interface every provider adapter implements, so routing, intents and
 * webhooks never branch on the provider name. Adapters own the provider's
 * payload shape, its signature scheme and its status vocabulary.
 */
export interface PaymentProvider {
  readonly id: Provider;
  /** Whether this provider can settle the given method. */
  supports(method: Method): boolean;
  createPayment(request: PaymentIntentRequest): Promise<PaymentResult>;
  refund(request: RefundRequest): Promise<RefundResult>;
  /** Verifies the signature and normalises the event; throws when the signature fails. */
  verifyWebhook(input: WebhookInput): WebhookEvent;
}
