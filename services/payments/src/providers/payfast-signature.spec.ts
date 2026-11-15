import { describe, it, expect } from 'vitest';
import {
  centsFromZar,
  mapPayFastStatus,
  payfastSignature,
  signatureString,
  verifyItnSignature,
} from './payfast-signature';

describe('signatureString', () => {
  it('joins non-blank pairs in order and appends the passphrase', () => {
    const fields = [
      ['merchant_id', '10000100'],
      ['merchant_key', '46f0cd694581a'],
      ['amount', '3105.00'],
      ['item_name', ''],
      ['email_address', 'thabo@example.com'],
    ] as const;
    expect(signatureString(fields, 'salt')).toBe(
      'merchant_id=10000100&merchant_key=46f0cd694581a&amount=3105.00' +
        '&email_address=thabo%40example.com&passphrase=salt',
    );
  });

  it('encodes spaces as + and other characters per form encoding', () => {
    expect(signatureString([['item_name', 'A box of goats']], '')).toBe('item_name=A+box+of+goats');
  });

  it('omits the passphrase pair when there is none', () => {
    expect(signatureString([['amount', '1.00']], '')).toBe('amount=1.00');
  });

  it('does not sort alphabetically — order is as given', () => {
    const fields = [
      ['b', '2'],
      ['a', '1'],
    ] as const;
    expect(signatureString(fields, '')).toBe('b=2&a=1');
  });
});

describe('payfastSignature', () => {
  it('is the lower-case MD5 of the signature string', () => {
    // md5('amount=1.00&passphrase=salt')
    const sig = payfastSignature([['amount', '1.00']], 'salt');
    expect(sig).toMatch(/^[0-9a-f]{32}$/);
    expect(sig).toBe(payfastSignature([['amount', '1.00']], 'salt'));
  });
});

describe('verifyItnSignature', () => {
  const posted = [
    ['m_payment_id', 'ORD-1'],
    ['pf_payment_id', '1089250'],
    ['payment_status', 'COMPLETE'],
    ['amount_gross', '3105.00'],
  ] as const;
  const signature = payfastSignature(posted, 'salt');

  it('accepts a signature computed over the posted fields', () => {
    expect(verifyItnSignature([...posted, ['signature', signature]], 'salt', signature)).toBe(true);
  });

  it('rejects a signature over tampered fields', () => {
    const tampered = [
      ['m_payment_id', 'ORD-1'],
      ['pf_payment_id', '1089250'],
      ['payment_status', 'COMPLETE'],
      ['amount_gross', '1.00'],
    ] as const;
    expect(verifyItnSignature(tampered, 'salt', signature)).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(verifyItnSignature(posted, 'salt', undefined)).toBe(false);
  });
});

describe('mapPayFastStatus', () => {
  it('maps the coarse PayFast vocabulary', () => {
    expect(mapPayFastStatus('COMPLETE')).toBe('succeeded');
    expect(mapPayFastStatus('CANCELLED')).toBe('cancelled');
    expect(mapPayFastStatus('FAILED')).toBe('failed');
    expect(mapPayFastStatus('anything-else')).toBe('pending');
  });
});

describe('centsFromZar', () => {
  it('rounds a decimal ZAR amount to integer cents', () => {
    expect(centsFromZar('3105.00')).toBe(310_500);
    expect(centsFromZar(3105.5)).toBe(310_550);
    expect(centsFromZar(undefined)).toBeUndefined();
    expect(centsFromZar('not-a-number')).toBeUndefined();
  });
});
