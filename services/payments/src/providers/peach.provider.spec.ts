import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { PeachProvider, mapPeachStatus } from './peach.provider';

const now = new Date('2026-11-14T10:00:00Z');
const t = Math.floor(now.getTime() / 1000);
const webhookSecret = 'peach_whsec';

function peach(overrides: Partial<ConstructorParameters<typeof PeachProvider>[0]> = {}) {
  return new PeachProvider({
    entityId: 'ent_1',
    accessToken: 'tok',
    webhookSecret,
    now: () => now,
    ...overrides,
  });
}

describe('mapPeachStatus', () => {
  it('maps Peach codes onto the neutral vocabulary', () => {
    expect(mapPeachStatus('successful')).toBe('succeeded');
    expect(mapPeachStatus('failed')).toBe('failed');
    expect(mapPeachStatus('cancelled')).toBe('cancelled');
    expect(mapPeachStatus('something-new')).toBe('pending');
  });
});

describe('PeachProvider', () => {
  it('supports card and pay by bank, not escrow', () => {
    const provider = peach();
    expect(provider.supports('card')).toBe(true);
    expect(provider.supports('pay_by_bank')).toBe(true);
    expect(provider.supports('escrow')).toBe(false);
  });

  it('creates a checkout and returns a provider reference', async () => {
    let sent: { url: string; body: unknown } | undefined;
    const fetchFn = (async (url: string, init: RequestInit) => {
      sent = { url, body: JSON.parse(init.body as string) };
      return new Response(JSON.stringify({ checkoutId: 'ch_1', result: { code: 'pending' } }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const result = await peach({ fetchFn }).createPayment({
      intentId: 'pi_1',
      amountCents: 310_500,
      currency: 'ZAR',
      method: 'card',
      reference: 'ORD-1',
      idempotencyKey: 'idem-1',
    });

    expect(result.providerRef).toBe('ch_1');
    expect(result.status).toBe('pending');
    expect(sent?.url).toContain('/v2/checkout');
    expect((sent?.body as Record<string, unknown>).merchantTransactionId).toBe('idem-1');
    expect((sent?.body as Record<string, unknown>).amount).toBe('3105.00');
  });

  it('throws when Peach returns no id', async () => {
    const fetchFn = (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    await expect(
      peach({ fetchFn }).createPayment({
        intentId: 'pi_1',
        amountCents: 1000,
        currency: 'ZAR',
        method: 'card',
        reference: 'ORD-1',
        idempotencyKey: 'idem-1',
      }),
    ).rejects.toThrow(/no id/);
  });

  it('verifies a signed webhook and normalises it', () => {
    const payload = JSON.stringify({
      id: 'evt_9',
      paymentId: 'pay_9',
      result: { code: 'successful' },
      amount: '3105.00',
    });
    const signature = `t=${t},v1=${createHmac('sha256', webhookSecret).update(`${t}.${payload}`).digest('hex')}`;
    const event = peach().verifyWebhook({
      headers: { 'x-webhook-signature': signature },
      rawBody: payload,
    });
    expect(event).toMatchObject({
      id: 'evt_9',
      providerRef: 'pay_9',
      status: 'succeeded',
      amountCents: 310_500,
    });
  });

  it('rejects a webhook with a bad signature', () => {
    const payload = JSON.stringify({
      id: 'evt_9',
      paymentId: 'pay_9',
      result: { code: 'successful' },
    });
    expect(() =>
      peach().verifyWebhook({
        headers: { 'x-webhook-signature': `t=${t},v1=deadbeef` },
        rawBody: payload,
      }),
    ).toThrow(/signature is invalid/);
  });
});
