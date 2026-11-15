import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { TradeSafeProvider, mapTradeSafeStatus } from './tradesafe.provider';

const now = new Date('2026-11-14T10:00:00Z');
const timestamp = String(Math.floor(now.getTime() / 1000));
const secret = 'tradesafe-webhook-secret';

function tradesafe(overrides: Partial<ConstructorParameters<typeof TradeSafeProvider>[0]> = {}) {
  return new TradeSafeProvider({
    clientId: 'client_1',
    clientSecret: 'secret',
    webhookSecret: secret,
    now: () => now,
    ...overrides,
  });
}

function signatureHeader(body: string): string {
  const v1 = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${v1}`;
}

describe('mapTradeSafeStatus', () => {
  it('maps TradeSafe states onto the neutral vocabulary', () => {
    expect(mapTradeSafeStatus('FUNDS_RECEIVED')).toBe('succeeded');
    expect(mapTradeSafeStatus('FUNDS_RELEASED')).toBe('succeeded');
    expect(mapTradeSafeStatus('CANCELLED')).toBe('cancelled');
    expect(mapTradeSafeStatus('FAILED')).toBe('failed');
    expect(mapTradeSafeStatus('EXPIRED')).toBe('failed');
    expect(mapTradeSafeStatus('PENDING')).toBe('pending');
    expect(mapTradeSafeStatus('something-new')).toBe('pending');
  });
});

describe('TradeSafeProvider', () => {
  it('supports escrow only', () => {
    const provider = tradesafe();
    expect(provider.supports('escrow')).toBe(true);
    expect(provider.supports('card')).toBe(false);
    expect(provider.supports('trade_bnpl')).toBe(false);
  });

  it('refuses escrow below R10,000 even if routing is bypassed', async () => {
    await expect(
      tradesafe().createPayment({
        intentId: 'pi_1',
        amountCents: 999_999,
        currency: 'ZAR',
        method: 'escrow',
        reference: 'ORD-1',
        idempotencyKey: 'idem-1',
      }),
    ).rejects.toThrow(/R10,000/);
  });

  it('creates an escrow transaction and returns the hosted URL', async () => {
    let sent: { url: string; body: Record<string, unknown> } | undefined;
    const fetchFn = (async (url: string, init: RequestInit) => {
      sent = { url, body: JSON.parse(init.body as string) };
      return new Response(
        JSON.stringify({ transactionId: 'ts_1', state: 'PENDING', redirectUrl: 'https://tradesafe.co.za/ts_1' }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const result = await tradesafe({ fetchFn }).createPayment({
      intentId: 'pi_1',
      amountCents: 1_500_000,
      currency: 'ZAR',
      method: 'escrow',
      reference: 'FARM-1',
      idempotencyKey: 'idem-1',
      returnUrl: 'https://amazinggoats.store/return',
      customer: { email: 'farmer@example.co.za' },
    });

    expect(result.providerRef).toBe('ts_1');
    expect(result.status).toBe('pending');
    expect(result.redirectUrl).toBe('https://tradesafe.co.za/ts_1');
    expect(sent?.url).toContain('/api/v1/transactions');
    expect(sent?.body.amount).toBe('15000.00');
    expect(sent?.body.idempotencyKey).toBe('idem-1');
  });

  it('refunds an escrow transaction', async () => {
    const fetchFn = (async () =>
      new Response(JSON.stringify({ id: 'tsr_1', state: 'PENDING' }), { status: 200 })) as unknown as typeof fetch;
    const result = await tradesafe({ fetchFn }).refund({
      paymentRef: 'ts_1',
      amountCents: 500_000,
      reason: 'short delivery',
      idempotencyKey: 'idem-refund-1',
    });
    expect(result.refundRef).toBe('tsr_1');
    expect(result.status).toBe('pending');
  });

  it('verifies a signed webhook and normalises the event', () => {
    const body = JSON.stringify({
      eventId: 'evt_1',
      type: 'escrow.funds_released',
      transactionId: 'ts_1',
      state: 'FUNDS_RELEASED',
      amount: '15000.00',
      occurredAt: '2026-11-14T10:00:00.000Z',
    });
    const event = tradesafe().verifyWebhook({
      headers: { 'x-tradesafe-signature': signatureHeader(body) },
      rawBody: body,
    });
    expect(event.id).toBe('evt_1');
    expect(event.providerRef).toBe('ts_1');
    expect(event.status).toBe('succeeded');
    expect(event.amountCents).toBe(1_500_000);
  });

  it('rejects a webhook with a bad signature', () => {
    const body = JSON.stringify({ transactionId: 'ts_1', state: 'FUNDS_RELEASED' });
    expect(() =>
      tradesafe().verifyWebhook({
        headers: { 'x-tradesafe-signature': `t=${timestamp},v1=deadbeef` },
        rawBody: body,
      }),
    ).toThrow(/signature is invalid/);
  });
});
