import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { StitchProvider, mapStitchStatus } from './stitch.provider';

const now = new Date('2026-11-14T10:00:00Z');
const timestamp = String(Math.floor(now.getTime() / 1000));
const rawSecret = Buffer.from('stitch-svix-signing-key').toString('base64');
const webhookSecret = `whsec_${rawSecret}`;

function stitch(overrides: Partial<ConstructorParameters<typeof StitchProvider>[0]> = {}) {
  return new StitchProvider({
    clientId: 'client_1',
    clientSecret: 'secret',
    webhookSecret,
    now: () => now,
    ...overrides,
  });
}

function svixSignature(id: string, body: string): string {
  const key = Buffer.from(rawSecret, 'base64');
  return createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
}

describe('mapStitchStatus', () => {
  it('maps Stitch states onto the neutral vocabulary', () => {
    expect(mapStitchStatus('PaymentInitiationRequestCompleted')).toBe('succeeded');
    expect(mapStitchStatus('PaymentInitiationRequestCancelled')).toBe('cancelled');
    expect(mapStitchStatus('PaymentInitiationRequestExpired')).toBe('failed');
    expect(mapStitchStatus('PaymentInitiationRequestPending')).toBe('pending');
    expect(mapStitchStatus('something-new')).toBe('pending');
  });
});

describe('StitchProvider', () => {
  it('supports pay by bank and recurring debit, not escrow', () => {
    const provider = stitch();
    expect(provider.supports('pay_by_bank')).toBe(true);
    expect(provider.supports('recurring_debit')).toBe(true);
    expect(provider.supports('escrow')).toBe(false);
  });

  it('creates a pay-by-bank request and returns the hosted URL', async () => {
    let sent: { query: string; variables: Record<string, unknown> } | undefined;
    const fetchFn = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(init.body as string);
      return new Response(
        JSON.stringify({
          data: {
            clientPaymentInitiationRequestCreate: {
              paymentInitiationRequest: { id: 'pr_1', url: 'https://stitch.money/pr_1' },
            },
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const result = await stitch({ fetchFn }).createPayment({
      intentId: 'pi_1',
      amountCents: 310_500,
      currency: 'ZAR',
      method: 'pay_by_bank',
      reference: 'ORD-1',
      idempotencyKey: 'idem-1',
      customer: { email: 'thabo@example.com' },
    });

    expect(result.providerRef).toBe('pr_1');
    expect(result.status).toBe('pending');
    expect(result.redirectUrl).toBe('https://stitch.money/pr_1');
    expect(sent?.query).toContain('clientPaymentInitiationRequestCreate');
    const input = (sent?.variables as { input: Record<string, unknown> }).input;
    expect(input.externalReference).toBe('idem-1');
    expect((input.amount as { quantity: string }).quantity).toBe('3105.00');
  });

  it('creates a recurring consent for a trade collection', async () => {
    let sent: { query: string; variables: Record<string, unknown> } | undefined;
    const fetchFn = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(init.body as string);
      return new Response(
        JSON.stringify({
          data: {
            clientPaymentConsentRequestCreate: {
              paymentConsentRequest: { id: 'consent_1', url: 'https://stitch.money/c_1' },
            },
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const result = await stitch({ fetchFn }).createPayment({
      intentId: 'pi_2',
      amountCents: 50_000,
      currency: 'ZAR',
      method: 'recurring_debit',
      reference: 'TRADE-7',
      idempotencyKey: 'idem-2',
    });

    expect(result.providerRef).toBe('consent_1');
    expect(sent?.query).toContain('clientPaymentConsentRequestCreate');
    const input = (sent?.variables as { input: Record<string, unknown> }).input;
    expect(input.type).toBe('CAPITEC_PAY_RECURRING');
    expect(input.frequency).toBe('MONTHLY');
  });

  it('throws when Stitch returns no payment request id', async () => {
    const fetchFn = (async () => new Response('{"data":{}}', { status: 200 })) as unknown as typeof fetch;
    await expect(
      stitch({ fetchFn }).createPayment({
        intentId: 'pi_1',
        amountCents: 1000,
        currency: 'ZAR',
        method: 'pay_by_bank',
        reference: 'ORD-1',
        idempotencyKey: 'idem-1',
      }),
    ).rejects.toThrow(/no payment request id/);
  });

  it('verifies a Svix-signed webhook and normalises it', () => {
    const body = JSON.stringify({
      type: 'payment-initiation-request',
      data: {
        id: 'evt_1',
        status: 'PaymentInitiationRequestCompleted',
        externalReference: 'idem-1',
        amount: { quantity: '3105.00', currency: 'ZAR' },
      },
    });
    const event = stitch().verifyWebhook({
      headers: {
        'svix-id': 'msg_1',
        'svix-timestamp': timestamp,
        'svix-signature': `v1,${svixSignature('msg_1', body)}`,
      },
      rawBody: body,
    });
    expect(event).toMatchObject({
      id: 'msg_1',
      providerRef: 'idem-1',
      status: 'succeeded',
      amountCents: 310_500,
    });
  });

  it('rejects a webhook with a bad signature', () => {
    const body = JSON.stringify({ data: { externalReference: 'idem-1' } });
    expect(() =>
      stitch().verifyWebhook({
        headers: {
          'svix-id': 'msg_1',
          'svix-timestamp': timestamp,
          'svix-signature': 'v1,deadbeef',
        },
        rawBody: body,
      }),
    ).toThrow(/signature is invalid/);
  });

  it('refunds through Stitch and maps the refund status', async () => {
    const fetchFn = (async () =>
      new Response(
        JSON.stringify({
          data: { refundTransactionInitiate: { refund: { id: 'rf_1', status: 'TransactionPending' } } },
        }),
        { status: 200 },
      )) as unknown as typeof fetch;

    const result = await stitch({ fetchFn }).refund({
      paymentRef: 'pr_1',
      amountCents: 10_000,
      idempotencyKey: 'r-1',
    });
    expect(result).toEqual({ refundRef: 'rf_1', status: 'pending' });
  });

  it('surfaces a GraphQL error', async () => {
    const fetchFn = (async () =>
      new Response(JSON.stringify({ errors: [{ message: 'invalid_scope' }] }), {
        status: 200,
      })) as unknown as typeof fetch;
    await expect(
      stitch({ fetchFn }).createPayment({
        intentId: 'pi_1',
        amountCents: 1000,
        currency: 'ZAR',
        method: 'pay_by_bank',
        reference: 'ORD-1',
        idempotencyKey: 'idem-1',
      }),
    ).rejects.toThrow(/invalid_scope/);
  });
});
