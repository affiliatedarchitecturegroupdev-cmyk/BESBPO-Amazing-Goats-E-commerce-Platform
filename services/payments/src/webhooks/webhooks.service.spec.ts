import { describe, it, expect } from 'vitest';
import { WebhooksService, WEBHOOK_STORE } from './webhooks.service';
import { InMemoryWebhookStore } from './webhooks.store';
import { IntentsService } from '../intents/intents.service';
import { InMemoryIntentStore } from '../intents/intents.store';
import { ProvidersService } from '../providers/providers.service';
import type {
  PaymentProvider,
  PaymentResult,
  RefundResult,
  WebhookEvent,
  WebhookInput,
} from '../providers/provider.interface';
import type { Provider } from '../routing/route-payment';

class FakeProvider implements PaymentProvider {
  readonly id: Provider = 'peach';
  supports(): boolean {
    return true;
  }
  async createPayment(): Promise<PaymentResult> {
    return { providerRef: 'ch_1', status: 'pending' };
  }
  async refund(): Promise<RefundResult> {
    return { refundRef: 'rf_1', status: 'pending' };
  }
  verifyWebhook(input: WebhookInput): WebhookEvent {
    if (!input.headers['x-ok']) throw new Error('Peach webhook signature is invalid');
    const body = JSON.parse(input.rawBody) as {
      id: string;
      providerRef: string;
      status: WebhookEvent['status'];
    };
    return {
      id: body.id,
      type: 'payment.status',
      providerRef: body.providerRef,
      status: body.status,
    };
  }
}

function makeService() {
  const intents = new IntentsService(
    new InMemoryIntentStore(),
    new ProvidersService([new FakeProvider()]),
  );
  const service = new WebhooksService(new InMemoryWebhookStore(), intents);
  return { service, intents };
}

describe('WebhooksService', () => {
  it('records a verified event and applies it to the intent', async () => {
    const { service, intents } = makeService();
    const intent = await intents.create({
      idempotencyKey: 'k1',
      method: 'card',
      amountIncVatCents: 1000,
    });
    const result = service.receive('peach', {
      headers: { 'x-ok': '1' },
      rawBody: JSON.stringify({
        id: 'evt_1',
        providerRef: intent.providerRef,
        status: 'succeeded',
      }),
    });
    expect(result).toEqual({ received: true, duplicate: false, eventId: 'evt_1' });
    expect(service.list()).toHaveLength(1);
  });

  it('rejects a bad signature with 400 and records nothing', () => {
    const { service } = makeService();
    expect(() => service.receive('peach', { headers: {}, rawBody: '{}' })).toThrow(/invalid/);
    expect(service.list()).toHaveLength(0);
  });

  it('deduplicates a retried delivery', async () => {
    const { service, intents } = makeService();
    const intent = await intents.create({
      idempotencyKey: 'k1',
      method: 'card',
      amountIncVatCents: 1000,
    });
    const input = {
      headers: { 'x-ok': '1' },
      rawBody: JSON.stringify({
        id: 'evt_1',
        providerRef: intent.providerRef,
        status: 'succeeded',
      }),
    };
    expect(service.receive('peach', input).duplicate).toBe(false);
    expect(service.receive('peach', input).duplicate).toBe(true);
    expect(service.list()).toHaveLength(1);
  });
});

describe('WEBHOOK_STORE token', () => {
  it('is defined', () => {
    expect(WEBHOOK_STORE).toBeDefined();
  });
});
