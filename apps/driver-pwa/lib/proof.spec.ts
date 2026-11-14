import { describe, it, expect } from 'vitest';
import { CHILLED_MAX_CELSIUS, formatCelsius, temperatureOutOfRange, validateProof } from './proof';
import type { Stop } from './daypack';

const stop = (over: Partial<Stop> = {}): Stop => ({
  id: 's1', sequence: 1, customer: 'Bakery B', address: '12 Main Rd', window: '08:30',
  items: [{ name: '20 egg trays', qty: 20 }], temperature: 'chilled', requiresSignature: true, ...over,
});

describe('validateProof', () => {
  it('accepts a drop with everything the stop needs', () => {
    expect(validateProof({ stop: stop({ cashExpectedCents: 12000 }), signatureDataUrl: 'data:', celsius: 3.4, cashCents: 12000 })).toEqual({ ok: true, missing: [] });
  });

  it('asks for a signature when the stop needs one', () => {
    const check = validateProof({ stop: stop(), celsius: 3.4 });
    expect(check.ok).toBe(false);
    expect(check.missing).toContain('signature');
  });

  it('asks for a probe reading for chilled goods', () => {
    expect(validateProof({ stop: stop(), signatureDataUrl: 'data:' }).missing).toContain('temperature');
  });

  it('asks for the cash when the customer pays on delivery', () => {
    expect(validateProof({ stop: stop({ requiresSignature: false, temperature: 'ambient', cashExpectedCents: 12000 }) }).missing).toContain('cash');
  });
});

describe('temperatureOutOfRange', () => {
  it('flags a reading above the cold chain limit', () => {
    expect(temperatureOutOfRange(CHILLED_MAX_CELSIUS)).toBe(false);
    expect(temperatureOutOfRange(CHILLED_MAX_CELSIUS + 0.1)).toBe(true);
  });
});

describe('formatCelsius', () => {
  it('shows one decimal and the degree sign', () => {
    expect(formatCelsius(3.4)).toBe('3.4°C');
  });
});
