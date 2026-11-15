import type { Method, Provider } from '../routing/route-payment';
import { ESCROW_MINIMUM_CENTS } from '../routing/route-payment';
import {
  PaymentIntentRequest,
  PaymentProvider,
  PaymentResult,
  ProviderPaymentStatus,
  RefundRequest,
  RefundResult,
  WebhookEvent,
  WebhookInput,
} from './provider.interface';
import { verifyHmacSignature } from './webhook-signature';

export interface TradeSafeConfig {
  clientId: string;
  clientSecret: string;
  /** Webhook signing secret, used to verify an incoming event. */
  webhookSecret: string;
  /** Overridable for a sandbox; defaults to the production host. */
  baseUrl?: string;
  fetchFn?: typeof fetch;
  now?: () => Date;
}

/** TradeSafe escrow states mapped onto the provider-neutral vocabulary. */
export function mapTradeSafeStatus(state: string): ProviderPaymentStatus {
  switch (state) {
    case 'FUNDS_RECEIVED':
    case 'FUNDS_RELEASED':
      return 'succeeded';
    case 'CANCELLED':
      return 'cancelled';
    case 'FAILED':
    case 'EXPIRED':
      return 'failed';
    default:
      return 'pending';
  }
}

/**
 * TradeSafe escrow adapter. TradeSafe holds a buyer's funds until both parties
 * accept the delivery, which is what a farm-gate purchase needs. Escrow carries a
 * minimum fee, so it is only offered from R10,000 (`ESCROW_MINIMUM_CENTS`); the
 * adapter refuses a smaller amount as a second line of defence behind routing.
 * It owns the TradeSafe request shape, its bearer token and its webhook signature.
 */
export class TradeSafeProvider implements PaymentProvider {
  readonly id: Provider = 'tradesafe';
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly config: TradeSafeConfig) {
    this.baseUrl = config.baseUrl ?? 'https://api.tradesafe.co.za';
    this.fetchFn = config.fetchFn ?? fetch;
  }

  supports(method: Method): boolean {
    return method === 'escrow';
  }

  async createPayment(request: PaymentIntentRequest): Promise<PaymentResult> {
    if (!this.supports(request.method)) {
      throw new Error(`TradeSafe does not support ${request.method}`);
    }
    if (request.amountCents < ESCROW_MINIMUM_CENTS) {
      throw new Error('Escrow is only offered from R10,000');
    }

    const response = await this.fetchFn(`${this.baseUrl}/api/v1/transactions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.clientSecret}`,
      },
      body: JSON.stringify({
        clientId: this.config.clientId,
        amount: (request.amountCents / 100).toFixed(2),
        currency: request.currency,
        reference: request.reference,
        idempotencyKey: request.idempotencyKey,
        returnUrl: request.returnUrl,
        notifyUrl: request.notifyUrl,
        buyer: request.customer,
      }),
    });
    const json = (await response.json()) as {
      id?: string;
      transactionId?: string;
      state?: string;
      redirectUrl?: string;
    };
    const providerRef = json.transactionId ?? json.id;
    if (!providerRef) throw new Error('TradeSafe returned no transaction id');
    return {
      providerRef,
      status: mapTradeSafeStatus(json.state ?? 'PENDING'),
      redirectUrl: json.redirectUrl,
    };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    const response = await this.fetchFn(
      `${this.baseUrl}/api/v1/transactions/${request.paymentRef}/refund`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.clientSecret}`,
        },
        body: JSON.stringify({
          amount: (request.amountCents / 100).toFixed(2),
          reason: request.reason,
          idempotencyKey: request.idempotencyKey,
        }),
      },
    );
    const json = (await response.json()) as { id?: string; state?: string };
    if (!json.id) throw new Error('TradeSafe refund returned no id');
    return { refundRef: json.id, status: mapTradeSafeStatus(json.state ?? 'PENDING') };
  }

  verifyWebhook(input: WebhookInput): WebhookEvent {
    const signature = first(
      input.headers['x-tradesafe-signature'] ?? input.headers['x-webhook-signature'],
    );
    const ok = verifyHmacSignature({
      secret: this.config.webhookSecret,
      rawBody: input.rawBody,
      signature,
      now: this.config.now?.() ?? new Date(),
    });
    if (!ok) throw new Error('TradeSafe webhook signature is invalid');

    const payload = JSON.parse(input.rawBody) as {
      id?: string;
      eventId?: string;
      type?: string;
      transactionId?: string;
      reference?: string;
      state?: string;
      amount?: string | number;
      occurredAt?: string;
    };
    const providerRef = payload.transactionId ?? payload.reference ?? payload.id;
    if (!providerRef) throw new Error('TradeSafe webhook has no transaction reference');
    return {
      id: String(payload.eventId ?? payload.id ?? providerRef),
      type: payload.type ?? 'escrow.status',
      providerRef,
      status: mapTradeSafeStatus(payload.state ?? 'PENDING'),
      amountCents:
        payload.amount !== undefined ? Math.round(Number(payload.amount) * 100) : undefined,
      occurredAt: payload.occurredAt,
    };
  }
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
