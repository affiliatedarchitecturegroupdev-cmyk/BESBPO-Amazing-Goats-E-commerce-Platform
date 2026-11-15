import type { Method, Provider } from '../routing/route-payment';
import {
  PaymentIntentRequest,
  PaymentProvider,
  PaymentResult,
  RefundRequest,
  RefundResult,
  WebhookEvent,
  WebhookInput,
} from './provider.interface';
import {
  PayFastFields,
  centsFromZar,
  mapPayFastStatus,
  payfastSignature,
  verifyItnSignature,
} from './payfast-signature';

export interface PayFastConfig {
  merchantId: string;
  merchantKey: string;
  /** Salt set in the PayFast dashboard; part of every signature. */
  passphrase: string;
  /** Overridable for the sandbox; defaults to the production host. */
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

/** PayFast payment_method codes for the methods the platform routes to it. */
const PAYFAST_METHOD: Partial<Record<Method, string>> = {
  card: 'cc',
  pay_by_bank: 'ef',
  wallet: 'mp',
  bnpl: 'pf',
};

/**
 * PayFast adapter. PayFast is a hosted-page provider: the customer is sent to its
 * page by a form POST, not a redirect, so `createPayment` returns the form fields
 * (signed) rather than a URL. Its signature is an MD5 over the ordered fields plus
 * the passphrase (`payfast-signature.ts`), which differs from the HMAC scheme the
 * interface assumes, so the adapter owns both here.
 */
export class PayFastProvider implements PaymentProvider {
  readonly id: Provider = 'payfast';
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly config: PayFastConfig) {
    this.baseUrl = config.baseUrl ?? 'https://www.payfast.co.za';
    this.fetchFn = config.fetchFn ?? fetch;
  }

  supports(method: Method): boolean {
    return PAYFAST_METHOD[method] !== undefined;
  }

  async createPayment(request: PaymentIntentRequest): Promise<PaymentResult> {
    const paymentMethod = PAYFAST_METHOD[request.method];
    if (!paymentMethod) throw new Error(`PayFast does not support ${request.method}`);

    const fields = this.checkoutFields(request, paymentMethod);
    const signature = payfastSignature(fields, this.config.passphrase);
    const form: Record<string, string> = Object.fromEntries(fields);
    form.signature = signature;

    return {
      // The merchant reference is what the ITN echoes back, so it is the handle
      // we reconcile on until PayFast's own pf_payment_id arrives.
      providerRef: request.idempotencyKey,
      status: 'pending',
      form: { action: `${this.baseUrl}/eng/process`, fields: form },
    };
  }

  /**
   * PayFast has no refund API in the checkout flow; refunds are raised in its
   * dashboard or via a support request. The adapter returns `pending` so the
   * refund is recorded and reconciled rather than reported as done.
   */
  async refund(request: RefundRequest): Promise<RefundResult> {
    void this.fetchFn;
    return { refundRef: `pf_refund_${request.idempotencyKey}`, status: 'pending' };
  }

  /**
   * Verifies and normalises an ITN. The body is form-encoded, so the raw bytes
   * are parsed as such (not JSON) and the `signature` field is checked over the
   * other fields in the order received.
   */
  verifyWebhook(input: WebhookInput): WebhookEvent {
    const posted = parseForm(input.rawBody);
    const signature = valueOf(posted, 'signature');
    if (!verifyItnSignature(posted, this.config.passphrase, signature)) {
      throw new Error('PayFast ITN signature is invalid');
    }

    const providerRef = valueOf(posted, 'm_payment_id');
    if (!providerRef) throw new Error('PayFast ITN has no m_payment_id');
    const pfPaymentId = valueOf(posted, 'pf_payment_id');
    return {
      id: pfPaymentId ?? providerRef,
      type: 'payment.status',
      providerRef,
      status: mapPayFastStatus(valueOf(posted, 'payment_status') ?? 'PENDING'),
      amountCents: centsFromZar(valueOf(posted, 'amount_gross')),
    };
  }

  private checkoutFields(request: PaymentIntentRequest, paymentMethod: string): PayFastFields {
    const fields: [string, string][] = [
      ['merchant_id', this.config.merchantId],
      ['merchant_key', this.config.merchantKey],
      ['return_url', request.returnUrl ?? ''],
      ['cancel_url', request.returnUrl ?? ''],
      ['notify_url', request.notifyUrl ?? ''],
      ['name_first', request.customer?.name?.split(' ')[0] ?? ''],
      ['name_last', request.customer?.name?.split(' ').slice(1).join(' ') ?? ''],
      ['email_address', request.customer?.email ?? ''],
      ['cell_number', request.customer?.phone ?? ''],
      ['m_payment_id', request.idempotencyKey],
      ['amount', (request.amountCents / 100).toFixed(2)],
      ['item_name', request.reference],
      ['payment_method', paymentMethod],
    ];
    return fields;
  }
}

/** Parses an `application/x-www-form-urlencoded` body into ordered name/value pairs. */
export function parseForm(rawBody: string): PayFastFields {
  if (!rawBody) return [];
  return rawBody
    .split('&')
    .map((pair) => {
      const index = pair.indexOf('=');
      if (index === -1) return [decode(pair), ''] as const;
      return [decode(pair.slice(0, index)), decode(pair.slice(index + 1))] as const;
    })
    .filter(([name]) => name !== '');
}

function decode(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, ' '));
}

function valueOf(fields: PayFastFields, name: string): string | undefined {
  const found = fields.find(([key]) => key === name);
  return found?.[1];
}
