import { createHmac } from 'node:crypto';
import { IntentsService } from '../../services/payments/src/intents/intents.service';
import { InMemoryIntentStore } from '../../services/payments/src/intents/intents.store';
import { ProvidersService } from '../../services/payments/src/providers/providers.service';
import { StitchProvider } from '../../services/payments/src/providers/stitch.provider';
import { WebhooksService } from '../../services/payments/src/webhooks/webhooks.service';
import { InMemoryWebhookStore } from '../../services/payments/src/webhooks/webhooks.store';

/**
 * Wires the payments service the way its module does, but with an in-memory
 * intent/webhook store and a Stitch adapter whose only stub is `fetch` — the
 * network boundary. Everything else (routing, fallback, signature check, status
 * transitions) is the real code the services run.
 */
export interface PaymentsHarness {
  intents: IntentsService;
  webhooks: WebhooksService;
  provider: StitchProvider;
  /** Signs a Stitch webhook body the way Svix does, so `verifyWebhook` accepts it. */
  sign(body: string): Record<string, string>;
  /** The Stitch payment request id the fake `fetch` returns, i.e. the providerRef. */
  createdRef: string;
}

export const STITCH_WEBHOOK_SECRET = 'whsec_' + Buffer.from('e2e-svix-key').toString('base64');

export function paymentsHarness(createdRef = 'pr_e2e_1'): PaymentsHarness {
  const provider = new StitchProvider({
    clientId: 'client_e2e',
    clientSecret: 'secret_e2e',
    webhookSecret: STITCH_WEBHOOK_SECRET,
    fetchFn: (async (_url: string, init: RequestInit) => {
      const { query } = JSON.parse(init.body as string) as { query: string };
      const created = query.includes('PaymentConsent')
        ? {
            clientPaymentConsentRequestCreate: {
              paymentConsentRequest: { id: createdRef, url: `https://stitch.test/${createdRef}` },
            },
          }
        : {
            clientPaymentInitiationRequestCreate: {
              paymentInitiationRequest: {
                id: createdRef,
                url: `https://stitch.test/${createdRef}`,
              },
            },
          };
      return new Response(JSON.stringify({ data: created }), { status: 200 });
    }) as unknown as typeof fetch,
  });

  const providers = new ProvidersService([provider]);
  const intents = new IntentsService(new InMemoryIntentStore(), providers);
  const webhooks = new WebhooksService(new InMemoryWebhookStore(), intents);

  const key = Buffer.from(STITCH_WEBHOOK_SECRET.replace(/^whsec_/, ''), 'base64');
  const sign = (body: string): Record<string, string> => {
    const id = 'msg_e2e';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', key)
      .update(`${id}.${timestamp}.${body}`)
      .digest('base64');
    return { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` };
  };

  return { intents, webhooks, provider, sign, createdRef };
}
