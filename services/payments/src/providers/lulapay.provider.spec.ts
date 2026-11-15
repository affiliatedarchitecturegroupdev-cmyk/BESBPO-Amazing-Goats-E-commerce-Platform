import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { LulaPayProvider, mapLulaPayStatus } from './lulapay.provider';

const secret = 'lulapay-webhook-secret';

function lulapay(overrides: Partial<ConstructorParameters<typeof LulaPayProvider>[0]> = {}) {
  return new LulaPayProvider({
    apiKey: 'key_1',
    webhookSecret: secret,
    enabled: true,
    ...overrides,
  });
}

function bodySignature(body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

describe('mapLulaPayStatus', () => {
  it('maps LulaPay states onto the neutral vocabulary', () => {
    expect(mapLulaPayStatus('APPROVED')).toBe('succeeded');
    expect(mapLulaPayStatus('SETTLED')).toBe('succeeded');
    expect(mapLulaPayStatus('DECLINED')).toBe('failed');
    expect(mapLulaPayStatus('EXPIRED')).toBe('failed');
    expect(mapLulaPayStatus('CANCELLED')).toBe('cancelled');
    expect(mapLulaPayStatus('PENDING')).toBe('pending');
    expect(mapLulaPayStatus('something-new')).toBe('pending');
  });
});

describe('LulaPayProvider', () => {
  it('supports trade terms only', () => {
    const provider = lulapay();
    expect(provider.supports('trade_bnpl')).toBe(true);
    expect(provider.supports('bnpl')).toBe(false);
    expect(provider.supports('escrow')).toBe(false);
  });

  it('refuses to charge while the pilot flag is off', async () => {
    await expect(
      lulapay({ enabled: false }).createPayment({
        intentId: 'pi_1',
        amountCents: 500_000,
        currency: 'ZAR',
        method: 'trade_bnpl',
        reference: 'ORD-1',
        idempotencyKey: 'idem-1',
      }),
    ).rejects.toThrow(/feature flag/);
  });

  it('creates a trade-terms checkout and returns the hosted URL', async () => {
    let sent: { url: string; body: Record<string, unknown> } | undefined;
    const fetchFn = (async (url: string, init: RequestInit) => {
      sent = { url, body: JSON.parse(init.body as string) };
      return new Response(
        JSON.stringify({ checkoutId: 'lp_1', state: 'PENDING', redirectUrl: 'https://lulapay.co.za/lp_1' }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const result = await lulapay({ fetchFn }).createPayment({
      intentId: 'pi_1',
      amountCents: 500_000,
      currency: 'ZAR',
      method: 'trade_bnpl',
      reference: 'ORD-1',
      idempotencyKey: 'idem-1',
      customer: { email: 'butcher@example.co.za' },
    });

    expect(result.providerRef).toBe('lp_1');
    expect(result.status).toBe('pending');
    expect(result.redirectUrl).toBe('https://lulapay.co.za/lp_1');
    expect(sent?.url).toContain('/v1/checkout');
    expect(sent?.body.amount).toBe('5000.00');
  });

  it('refunds a checkout', async () => {
    const fetchFn = (async () =>
      new Response(JSON.stringify({ id: 'lpr_1', state: 'PENDING' }), { status: 200 })) as unknown as typeof fetch;
    const result = await lulapay({ fetchFn }).refund({
      paymentRef: 'lp_1',
      amountCents: 500_000,
      idempotencyKey: 'idem-refund-1',
    });
    expect(result.refundRef).toBe('lpr_1');
  });

  it('verifies a body-signed webhook and normalises the event', () => {
    const body = JSON.stringify({
      eventId: 'evt_1',
      type: 'checkout.approved',
      checkoutId: 'lp_1',
      state: 'APPROVED',
      amount: '5000.00',
    });
    const event = lulapay().verifyWebhook({
      headers: { 'x-lulapay-signature': bodySignature(body) },
      rawBody: body,
    });
    expect(event.id).toBe('evt_1');
    expect(event.providerRef).toBe('lp_1');
    expect(event.status).toBe('succeeded');
    expect(event.amountCents).toBe(500_000);
  });

  it('rejects a webhook with a bad signature', () => {
    const body = JSON.stringify({ checkoutId: 'lp_1', state: 'APPROVED' });
    expect(() =>
      lulapay().verifyWebhook({
        headers: { 'x-lulapay-signature': 'deadbeef' },
        rawBody: body,
      }),
    ).toThrow(/signature is invalid/);
  });
});
