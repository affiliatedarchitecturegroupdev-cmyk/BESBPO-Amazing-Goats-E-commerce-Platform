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
import { verifySvixSignature } from './webhook-signature';

export interface StitchConfig {
  clientId: string;
  clientSecret: string;
  /** Svix signing secret for this endpoint, as `whsec_<base64>`. */
  webhookSecret: string;
  /** Overridable for a sandbox; defaults to the production GraphQL host. */
  baseUrl?: string;
  fetchFn?: typeof fetch;
  now?: () => Date;
}

/** Stitch payment request states mapped onto the provider-neutral vocabulary. */
export function mapStitchStatus(state: string): ProviderPaymentStatus {
  switch (state) {
    case 'PaymentInitiationRequestCompleted':
    case 'TransactionSucceeded':
      return 'succeeded';
    case 'PaymentInitiationRequestCancelled':
    case 'TransactionCancelled':
      return 'cancelled';
    case 'PaymentInitiationRequestExpired':
    case 'TransactionFailed':
      return 'failed';
    default:
      return 'pending';
  }
}

const STITCH_METHOD: Partial<Record<Method, string>> = {
  pay_by_bank: 'PAY_BY_BANK',
  card: 'CARD',
  recurring_debit: 'RECURRING_DEBIT',
};

/**
 * Stitch adapter. Stitch fronts the bank rails — Pay by Bank (Capitec Pay, Absa
 * Pay, PayShap Request) for pay-by-bank and Capitec variable-recurring consents
 * for trade collections. It is a hosted redirect provider: `createPayment`
 * returns the Stitch-hosted URL for the customer. The API is GraphQL, its webhooks
 * are delivered through Svix, and both facts stay inside this adapter.
 */
export class StitchProvider implements PaymentProvider {
  readonly id: Provider = 'stitch';
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly config: StitchConfig) {
    this.baseUrl = config.baseUrl ?? 'https://api.stitch.money/graphql';
    this.fetchFn = config.fetchFn ?? fetch;
  }

  supports(method: Method): boolean {
    return STITCH_METHOD[method] !== undefined;
  }

  async createPayment(request: PaymentIntentRequest): Promise<PaymentResult> {
    if (!this.supports(request.method)) {
      throw new Error(`Stitch does not support ${request.method}`);
    }

    const { query, variables } = this.createRequestQuery(request);
    const data = await this.graphql<{
      clientPaymentInitiationRequestCreate?: {
        paymentInitiationRequest?: { id?: string; url?: string };
      };
      clientPaymentConsentRequestCreate?: {
        paymentConsentRequest?: { id?: string; url?: string };
      };
    }>(query, variables);

    const created =
      data.clientPaymentInitiationRequestCreate?.paymentInitiationRequest ??
      data.clientPaymentConsentRequestCreate?.paymentConsentRequest;
    const providerRef = created?.id;
    if (!providerRef) throw new Error('Stitch returned no payment request id');
    return { providerRef, status: 'pending', redirectUrl: created?.url };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    const data = await this.graphql<{
      refundTransactionInitiate?: { refund?: { id?: string; status?: string } };
    }>(
      `mutation Refund($input: RefundInitiateInput!) {
         refundTransactionInitiate(input: $input) { refund { id status } }
       }`,
      {
        input: {
          paymentId: request.paymentRef,
          amount: { quantity: (request.amountCents / 100).toFixed(2), currency: 'ZAR' },
          reason: request.reason,
          nonce: request.idempotencyKey,
        },
      },
    );
    const refund = data.refundTransactionInitiate?.refund;
    if (!refund?.id) throw new Error('Stitch refund returned no id');
    return { refundRef: refund.id, status: mapStitchStatus(refund.status ?? 'TransactionPending') };
  }

  verifyWebhook(input: WebhookInput): WebhookEvent {
    const id = header(input.headers, 'svix-id');
    const timestamp = header(input.headers, 'svix-timestamp');
    const signature = header(input.headers, 'svix-signature');
    const ok = verifySvixSignature({
      secret: this.config.webhookSecret,
      rawBody: input.rawBody,
      id,
      timestampSec: timestamp ? Number(timestamp) : undefined,
      signature,
      now: this.config.now?.() ?? new Date(),
    });
    if (!ok) throw new Error('Stitch webhook signature is invalid');

    const payload = JSON.parse(input.rawBody) as {
      type?: string;
      data?: {
        id?: string;
        status?: string;
        externalReference?: string;
        paymentInitiationRequest?: { id?: string; externalReference?: string };
        amount?: { quantity?: string | number };
      };
    };
    const data = payload.data ?? {};
    const providerRef =
      data.externalReference ??
      data.paymentInitiationRequest?.externalReference ??
      data.paymentInitiationRequest?.id ??
      data.id;
    if (!providerRef) throw new Error('Stitch webhook has no payment reference');
    return {
      id: id ?? String(data.id ?? providerRef),
      type: payload.type ?? 'payment.status',
      providerRef,
      status: mapStitchStatus(data.status ?? 'PaymentInitiationRequestPending'),
      amountCents:
        data.amount?.quantity !== undefined
          ? Math.round(Number(data.amount.quantity) * 100)
          : undefined,
    };
  }

  /** Builds the GraphQL call for a payment request (pay by bank) or a recurring consent. */
  private createRequestQuery(request: PaymentIntentRequest): {
    query: string;
    variables: Record<string, unknown>;
  } {
    if (request.method === 'recurring_debit') {
      return {
        query: `mutation CreateRecurringConsent($input: ClientPaymentConsentRequestCreateInput!) {
           clientPaymentConsentRequestCreate(input: $input) {
             paymentConsentRequest { id url }
           }
         }`,
        variables: {
          input: {
            type: 'CAPITEC_PAY_RECURRING',
            externalReference: request.idempotencyKey,
            amount: { quantity: (request.amountCents / 100).toFixed(2), currency: 'ZAR' },
            frequency: 'MONTHLY',
            payerInformation: { payerId: request.customer?.email },
          },
        },
      };
    }

    const method = request.method === 'card' ? 'card' : 'eft';
    return {
      query: `mutation CreatePaymentRequest($input: ClientPaymentInitiationRequestCreateInput!) {
         clientPaymentInitiationRequestCreate(input: $input) {
           paymentInitiationRequest { id url }
         }
       }`,
      variables: {
        input: {
          amount: { quantity: (request.amountCents / 100).toFixed(2), currency: 'ZAR' },
          externalReference: request.idempotencyKey,
          payerReference: request.reference.slice(0, 12),
          beneficiaryReference: (request.reference ?? '').slice(0, 20),
          beneficiaryName: 'Amazing Goats',
          payerInformation: { payerId: request.customer?.email },
          // Explicitly disable the methods this request must not offer, because
          // Stitch includes every method enabled on the client by default.
          paymentMethods: {
            eft: { enabled: method === 'eft' },
            card: { enabled: method === 'card' },
          },
        },
      },
    };
  }

  private async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await this.fetchFn(this.baseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.clientId}:${this.config.clientSecret}`,
      },
      body: JSON.stringify({ query, variables }),
    });
    const json = (await response.json()) as { data?: T; errors?: { message?: string }[] };
    if (json.errors?.length) throw new Error(`Stitch: ${json.errors[0]?.message ?? 'error'}`);
    if (!json.data) throw new Error('Stitch returned no data');
    return json.data;
  }
}

function header(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}
