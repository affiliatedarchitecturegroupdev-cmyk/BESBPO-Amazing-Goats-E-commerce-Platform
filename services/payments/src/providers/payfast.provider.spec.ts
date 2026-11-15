import { describe, it, expect } from 'vitest';
import { PayFastProvider, parseForm } from './payfast.provider';
import { payfastSignature } from './payfast-signature';
import type { PaymentIntentRequest } from './provider.interface';

const passphrase = 'salt';

function payfast(overrides: Partial<ConstructorParameters<typeof PayFastProvider>[0]> = {}) {
  return new PayFastProvider({
    merchantId: '10000100',
    merchantKey: '46f0cd694581a',
    passphrase,
    ...overrides,
  });
}

const request: PaymentIntentRequest = {
  intentId: 'pi_1',
  amountCents: 310_500,
  currency: 'ZAR',
  method: 'card',
  reference: 'ORD-1',
  idempotencyKey: 'idem-1',
  returnUrl: 'https://goats.example/return',
  notifyUrl: 'https://goats.example/notify',
  customer: { name: 'Thabo Nkosi', email: 'thabo@example.com', phone: '0823456789' },
};

describe('PayFastProvider', () => {
  it('supports card and pay by bank, not escrow', () => {
    const provider = payfast();
    expect(provider.supports('card')).toBe(true);
    expect(provider.supports('pay_by_bank')).toBe(true);
    expect(provider.supports('escrow')).toBe(false);
  });

  it('returns a signed hosted-page form for the checkout', async () => {
    const result = await payfast().createPayment(request);

    expect(result.providerRef).toBe('idem-1');
    expect(result.status).toBe('pending');
    expect(result.form?.action).toBe('https://www.payfast.co.za/eng/process');
    const fields = result.form!.fields;
    expect(fields.merchant_id).toBe('10000100');
    expect(fields.m_payment_id).toBe('idem-1');
    expect(fields.amount).toBe('3105.00');
    expect(fields.payment_method).toBe('cc');
    expect(fields.email_address).toBe('thabo@example.com');
    expect(fields.name_first).toBe('Thabo');
    expect(fields.name_last).toBe('Nkosi');

    // The signature must match the ordered fields plus the passphrase.
    const expected = payfastSignature(
      Object.entries(fields).filter(([name]) => name !== 'signature') as [string, string][],
      passphrase,
    );
    expect(fields.signature).toBe(expected);
  });

  it('honours the sandbox base URL', async () => {
    const result = await payfast({ baseUrl: 'https://sandbox.payfast.co.za' }).createPayment(
      request,
    );
    expect(result.form?.action).toBe('https://sandbox.payfast.co.za/eng/process');
  });

  it('verifies a signed ITN and normalises it to a neutral event', () => {
    const posted: [string, string][] = [
      ['m_payment_id', 'idem-1'],
      ['pf_payment_id', '1089250'],
      ['payment_status', 'COMPLETE'],
      ['amount_gross', '3105.00'],
      ['item_name', 'ORD-1'],
    ];
    const signature = payfastSignature(posted, passphrase);
    const rawBody = [...posted, ['signature', signature] as [string, string]]
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    const event = payfast().verifyWebhook({ headers: {}, rawBody });

    expect(event).toMatchObject({
      id: '1089250',
      providerRef: 'idem-1',
      status: 'succeeded',
      amountCents: 310_500,
    });
  });

  it('rejects an ITN with a bad signature', () => {
    const rawBody =
      'm_payment_id=idem-1&pf_payment_id=1089250&payment_status=COMPLETE&amount_gross=3105.00&signature=deadbeef';
    expect(() => payfast().verifyWebhook({ headers: {}, rawBody })).toThrow(/signature is invalid/);
  });

  it('rejects an ITN with no merchant reference', () => {
    const posted: [string, string][] = [
      ['pf_payment_id', '1089250'],
      ['payment_status', 'COMPLETE'],
    ];
    const signature = payfastSignature(posted, passphrase);
    const rawBody = [...posted, ['signature', signature] as [string, string]]
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    expect(() => payfast().verifyWebhook({ headers: {}, rawBody })).toThrow(/no m_payment_id/);
  });

  it('records a refund as pending (PayFast refunds are handled off-platform)', async () => {
    const result = await payfast().refund({
      paymentRef: 'idem-1',
      amountCents: 1000,
      idempotencyKey: 'r-1',
    });
    expect(result).toEqual({ refundRef: 'pf_refund_r-1', status: 'pending' });
  });
});

describe('parseForm', () => {
  it('parses an ordered form body and decodes + as space', () => {
    expect(parseForm('a=1&item_name=A+box&b=2')).toEqual([
      ['a', '1'],
      ['item_name', 'A box'],
      ['b', '2'],
    ]);
  });

  it('handles an empty body', () => {
    expect(parseForm('')).toEqual([]);
  });
});
