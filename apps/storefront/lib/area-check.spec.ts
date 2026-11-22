import { describe, it, expect } from 'vitest';
import type { AreaCheck } from '@ag/api-client';
import { areaCheckView, feeLine, shortDate } from './area-check';

const served: AreaCheck = {
  served: true,
  zone: { id: 2, code: 'KZN-DBN', name: 'Durban' },
  nextSlot: '2026-11-18T04:00:00.000Z',
  feeCents: 9000,
  cutoffAt: '2026-11-15T15:00:00.000Z',
  feeIncludesVat: true,
  freeOverApplied: false,
};

describe('shortDate', () => {
  it('renders in South African time, so the date does not slip a day', () => {
    // 15:00Z is 17:00 SAST on the same day; 22:30Z is 00:30 the next day.
    expect(shortDate('2026-11-15T15:00:00.000Z')).toContain('15');
    expect(shortDate('2026-11-15T22:30:00.000Z')).toContain('16');
  });
});

describe('feeLine', () => {
  it('states the VAT position with the fee', () => {
    expect(feeLine(9000, true)).toBe('R90,00 delivery (incl. VAT)');
    expect(feeLine(9000, false)).toBe('R90,00 delivery (excl. VAT)');
  });

  it('says free rather than R0.00', () => {
    expect(feeLine(0, true)).toBe('Free delivery');
  });
});

describe('areaCheckView', () => {
  it('names the zone, the fee, the next date and the cut-off when served', () => {
    const view = areaCheckView(served);
    expect(view.tone).toBe('served');
    expect(view.headline).toBe('We deliver to Durban');
    expect(view.detail).toContain('R90,00 delivery (incl. VAT)');
    expect(view.detail).toContain('Next delivery');
    expect(view.detail).toContain('order by');
    expect(view.detail).not.toContain('free delivery');
  });

  it('explains why delivery is free when the threshold was met', () => {
    const view = areaCheckView({ ...served, feeCents: 0, freeOverApplied: true });
    expect(view.detail).toContain('Free delivery');
    expect(view.detail).toContain('qualifies for free delivery');
  });

  it('does not promise a date when no slot is open', () => {
    const view = areaCheckView({ ...served, nextSlot: null });
    expect(view.detail).toContain('No delivery slot is open yet');
    expect(view.detail).not.toContain('Next delivery');
  });

  it('is honest about an unserved area and offers the waitlist', () => {
    const view = areaCheckView({
      served: false,
      area: 'kimberley',
      needsArea: false,
      waitlist: { available: true },
    });
    expect(view.tone).toBe('unserved');
    expect(view.headline).toBe('We do not deliver to kimberley yet');
    expect(view.detail).toContain('Leave your email');
  });

  it('asks for an area when none was given', () => {
    const view = areaCheckView({ served: false, area: '', needsArea: true, waitlist: { available: true } });
    expect(view.tone).toBe('needs-area');
    expect(view.detail).toContain('Enter your suburb');
  });
});
