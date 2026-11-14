import type { Method, Provider } from '../routing/route-payment';
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

export interface PeachConfig {
  entityId: string;
  accessToken: string;
  /** Webhook signing secret, used to verify an incoming event. */
  webhookSecret: string;
  /** Overridable for a sandbox; defaults to the production host. */
  baseUrl?: string;
  fetchFn?: typeof fetch;
  now?: () => Date;
}

/** Peach status codes mapped onto the provider-neutral vocabulary. */
export function mapPeachStatus(code: string): ProviderPaymentStatus {
  switch (code) {
    case 'successful':
    case 'captured':
      return 'succeeded';
    case 'failed':
    case 'error':
      return 'failed';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

const PEACH_METHOD: Partial<Record<Method, string>> = {
  card: 'CARD',
  pay_by_bank: 'PAY_BY_BANK',
  wallet: 'WALLET',
  bnpl: 'BNPL',
};

/**
 * Peach Payments adapter. Owns the Peach request shape, its OAuth bearer token
 * and its webhook signature so no other code branches on the provider name.
 */
export class PeachProvider implements PaymentProvider {
  readonly id: Provider = 'peach';
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly config: PeachConfig) {
    this.baseUrl = config.baseUrl ?? 'https://api.peachpayments.com';
    this.fetchFn = config.fetchFn ?? fetch;
  }

  supports(method: Method): boolean {
    return PEACH_METHOD[method] !== undefined;
  }

  async createPayment(request: PaymentIntentRequest): Promise<PaymentResult> {
    const paymentType = PEACH_METHOD[request.method];
    if (!paymentType) throw new Error(`Peach does not support ${request.method}`);

    const body = {
      entityId: this.config.entityId,
      amount: (request.amountCents / 100).toFixed(2),
      currency: request.currency,
      paymentType,
      merchantTransactionId: request.idempotencyKey,
      shopperResultUrl: request.returnUrl,
      notificationUrl: request.notifyUrl,
    };

    const response = await this.fetchFn(`${this.baseUrl}/v2/checkout`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await response.json()) as {
      id?: string;
      checkoutId?: string;
      redirectUrl?: string;
      result?: { code?: string };
    };
    const providerRef = json.checkoutId ?? json.id;
    if (!providerRef) throw new Error('Peach checkout returned no id');
    return {
      providerRef,
      status: mapPeachStatus(json.result?.code ?? 'pending'),
      redirectUrl: json.redirectUrl,
    };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    const response = await this.fetchFn(
      `${this.baseUrl}/v2/payments/${request.paymentRef}/refunds`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.accessToken}`,
        },
        body: JSON.stringify({
          amount: (request.amountCents / 100).toFixed(2),
          merchantTransactionId: request.idempotencyKey,
          reason: request.reason,
        }),
      },
    );
    const json = (await response.json()) as { id?: string; result?: { code?: string } };
    if (!json.id) throw new Error('Peach refund returned no id');
    return { refundRef: json.id, status: mapPeachStatus(json.result?.code ?? 'pending') };
  }

  verifyWebhook(input: WebhookInput): WebhookEvent {
    const signature = first(
      input.headers['x-webhook-signature'] ?? input.headers['x-peach-signature'],
    );
    const ok = verifyHmacSignature({
      secret: this.config.webhookSecret,
      rawBody: input.rawBody,
      signature,
      now: this.config.now?.() ?? new Date(),
    });
    if (!ok) throw new Error('Peach webhook signature is invalid');

    const payload = JSON.parse(input.rawBody) as {
      id?: string;
      merchantTransactionId?: string;
      paymentId?: string;
      result?: { code?: string };
      amount?: string | number;
      timestamp?: string;
    };
    const providerRef = payload.paymentId ?? payload.id ?? payload.merchantTransactionId;
    if (!providerRef) throw new Error('Peach webhook has no payment reference');
    return {
      id: String(payload.id ?? providerRef),
      type: 'payment.status',
      providerRef,
      status: mapPeachStatus(payload.result?.code ?? 'pending'),
      amountCents:
        payload.amount !== undefined ? Math.round(Number(payload.amount) * 100) : undefined,
      occurredAt: payload.timestamp,
    };
  }
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
