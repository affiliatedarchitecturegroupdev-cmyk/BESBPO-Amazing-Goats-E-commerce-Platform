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
import { verifyHmacBody } from './webhook-signature';

export interface LulaPayConfig {
  apiKey: string;
  /** Webhook signing secret; LulaPay signs the body directly. */
  webhookSecret: string;
  /**
   * The pilot switch. When off, `createPayment` refuses so the pilot cannot be
   * reached by a stray route even if the adapter was registered (docs/05-payments.md).
   */
  enabled: boolean;
  /** Overridable for a sandbox; defaults to the production host. */
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

/** LulaPay application states mapped onto the provider-neutral vocabulary. */
export function mapLulaPayStatus(state: string): ProviderPaymentStatus {
  switch (state) {
    case 'APPROVED':
    case 'SETTLED':
      return 'succeeded';
    case 'DECLINED':
    case 'EXPIRED':
      return 'failed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'pending';
  }
}

/**
 * LulaPay adapter. LulaPay is a trade BNPL provider: the merchant is paid now and
 * the trade buyer settles over longer terms, so it settles the `trade_bnpl`
 * method. It is a Phase 2 pilot behind a feature flag, so `createPayment` refuses
 * while `enabled` is false.
 */
export class LulaPayProvider implements PaymentProvider {
  readonly id: Provider = 'lulapay';
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly config: LulaPayConfig) {
    this.baseUrl = config.baseUrl ?? 'https://api.lulapay.co.za';
    this.fetchFn = config.fetchFn ?? fetch;
  }

  supports(method: Method): boolean {
    return method === 'trade_bnpl';
  }

  async createPayment(request: PaymentIntentRequest): Promise<PaymentResult> {
    if (!this.config.enabled) {
      throw new Error('LulaPay is a pilot behind a feature flag and is not enabled');
    }
    if (!this.supports(request.method)) {
      throw new Error(`LulaPay does not support ${request.method}`);
    }

    const response = await this.fetchFn(`${this.baseUrl}/v1/checkout`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        amount: (request.amountCents / 100).toFixed(2),
        currency: request.currency,
        reference: request.reference,
        idempotencyKey: request.idempotencyKey,
        returnUrl: request.returnUrl,
        notifyUrl: request.notifyUrl,
        customer: request.customer,
      }),
    });
    const json = (await response.json()) as {
      id?: string;
      checkoutId?: string;
      state?: string;
      redirectUrl?: string;
    };
    const providerRef = json.checkoutId ?? json.id;
    if (!providerRef) throw new Error('LulaPay returned no checkout id');
    return {
      providerRef,
      status: mapLulaPayStatus(json.state ?? 'PENDING'),
      redirectUrl: json.redirectUrl,
    };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    const response = await this.fetchFn(
      `${this.baseUrl}/v1/checkouts/${request.paymentRef}/refund`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          amount: (request.amountCents / 100).toFixed(2),
          reason: request.reason,
          idempotencyKey: request.idempotencyKey,
        }),
      },
    );
    const json = (await response.json()) as { id?: string; state?: string };
    if (!json.id) throw new Error('LulaPay refund returned no id');
    return { refundRef: json.id, status: mapLulaPayStatus(json.state ?? 'PENDING') };
  }

  verifyWebhook(input: WebhookInput): WebhookEvent {
    const signature = first(
      input.headers['x-lulapay-signature'] ?? input.headers['x-signature'],
    );
    const ok = verifyHmacBody(this.config.webhookSecret, input.rawBody, signature);
    if (!ok) throw new Error('LulaPay webhook signature is invalid');

    const payload = JSON.parse(input.rawBody) as {
      id?: string;
      eventId?: string;
      type?: string;
      checkoutId?: string;
      reference?: string;
      state?: string;
      amount?: string | number;
      occurredAt?: string;
    };
    const providerRef = payload.checkoutId ?? payload.reference ?? payload.id;
    if (!providerRef) throw new Error('LulaPay webhook has no checkout reference');
    return {
      id: String(payload.eventId ?? payload.id ?? providerRef),
      type: payload.type ?? 'checkout.status',
      providerRef,
      status: mapLulaPayStatus(payload.state ?? 'PENDING'),
      amountCents:
        payload.amount !== undefined ? Math.round(Number(payload.amount) * 100) : undefined,
      occurredAt: payload.occurredAt,
    };
  }
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
