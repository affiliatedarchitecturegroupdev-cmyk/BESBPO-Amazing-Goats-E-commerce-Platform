import { describe, it, expect } from 'vitest';
import { IntentsService, INTENT_STORE } from './intents.service';
import { InMemoryIntentStore } from './intents.store';
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
  constructor(
    readonly id: Provider = 'peach',
    private readonly status: PaymentResult['status'] = 'pending',
    private readonly fail = false,
  ) {}
  supports(): boolean {
    return true;
  }
  async createPayment(): Promise<PaymentResult> {
    if (this.fail) throw new Error(`${this.id} is down`);
    return { providerRef: 'ch_1', status: this.status, redirectUrl: 'https://peach.test/pay' };
  }
  async refund(): Promise<RefundResult> {
    return { refundRef: 'rf_1', status: 'pending' };
  }
  verifyWebhook(input: WebhookInput): WebhookEvent {
    if (!input.headers['x-ok']) throw new Error('bad signature');
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

function makeService(status: PaymentResult['status'] = 'pending') {
  const store = new InMemoryIntentStore();
  const providers = new ProvidersService([new FakeProvider('peach', status)]);
  return { service: new IntentsService(store, providers), store };
}

describe('IntentsService', () => {
  it('creates an intent, routes it and stores the provider reference', async () => {
    const { service } = makeService();
    const intent = await service.create({
      idempotencyKey: 'k1',
      method: 'card',
      amountIncVatCents: 310_500,
    });
    expect(intent.provider).toBe('peach');
    expect(intent.providerRef).toBe('ch_1');
    expect(intent.status).toBe('pending');
  });

  it('does not charge twice for the same idempotency key', async () => {
    const { service } = makeService();
    const first = await service.create({
      idempotencyKey: 'k1',
      method: 'card',
      amountIncVatCents: 1000,
    });
    const second = await service.create({
      idempotencyKey: 'k1',
      method: 'card',
      amountIncVatCents: 1000,
    });
    expect(second).toEqual(first);
  });

  it('rejects a method with no configured provider', async () => {
    const store = new InMemoryIntentStore();
    const service = new IntentsService(store, new ProvidersService([]));
    await expect(
      service.create({ idempotencyKey: 'k1', method: 'card', amountIncVatCents: 1000 }),
    ).rejects.toThrow(/no configured provider/);
  });

  it('falls back to the next routed provider when the primary fails', async () => {
    const store = new InMemoryIntentStore();
    // card routes to peach, payfast, stitch; only payfast and stitch are configured,
    // and payfast is down, so stitch is used.
    const providers = new ProvidersService([
      new FakeProvider('payfast', 'pending', true),
      new FakeProvider('stitch', 'pending', false),
    ]);
    const service = new IntentsService(store, providers);
    const intent = await service.create({
      idempotencyKey: 'k1',
      method: 'card',
      amountIncVatCents: 1000,
    });
    expect(intent.provider).toBe('stitch');
  });

  it('answers 503 when every routed provider fails', async () => {
    const store = new InMemoryIntentStore();
    const providers = new ProvidersService([
      new FakeProvider('peach', 'pending', true),
      new FakeProvider('payfast', 'pending', true),
      new FakeProvider('stitch', 'pending', true),
    ]);
    const service = new IntentsService(store, providers);
    await expect(
      service.create({ idempotencyKey: 'k1', method: 'card', amountIncVatCents: 1000 }),
    ).rejects.toThrow(/every provider failed/);
  });

  it('applies a verified webhook to the matching intent', async () => {
    const { service } = makeService();
    const intent = await service.create({
      idempotencyKey: 'k1',
      method: 'card',
      amountIncVatCents: 1000,
    });
    const result = await service.handleWebhook('peach', {
      headers: { 'x-ok': '1' },
      rawBody: JSON.stringify({
        id: 'evt_1',
        providerRef: intent.providerRef,
        status: 'succeeded',
      }),
    });
    expect(result.intent?.status).toBe('succeeded');
    expect((await service.get(intent.id)).status).toBe('succeeded');
  });

  it('propagates a bad signature so the caller can answer 400', async () => {
    const { service } = makeService();
    await expect(
      service.handleWebhook('peach', {
        headers: {},
        rawBody: JSON.stringify({ id: 'evt_1', providerRef: 'ch_1', status: 'succeeded' }),
      }),
    ).rejects.toThrow(/bad signature/);
  });

  it('ignores an out-of-order transition and keeps the intent terminal', async () => {
    const { service } = makeService();
    const intent = await service.create({
      idempotencyKey: 'k1',
      method: 'card',
      amountIncVatCents: 1000,
    });
    await service.handleWebhook('peach', {
      headers: { 'x-ok': '1' },
      rawBody: JSON.stringify({ id: 'e1', providerRef: intent.providerRef, status: 'succeeded' }),
    });
    const later = await service.handleWebhook('peach', {
      headers: { 'x-ok': '1' },
      rawBody: JSON.stringify({ id: 'e2', providerRef: intent.providerRef, status: 'failed' }),
    });
    expect(later.intent?.status).toBe('succeeded');
    expect((await service.get(intent.id)).status).toBe('succeeded');
  });
});

// The injection token exists so a SQL store can replace the in-memory one.
describe('INTENT_STORE token', () => {
  it('is defined', () => {
    expect(INTENT_STORE).toBeDefined();
  });
});
