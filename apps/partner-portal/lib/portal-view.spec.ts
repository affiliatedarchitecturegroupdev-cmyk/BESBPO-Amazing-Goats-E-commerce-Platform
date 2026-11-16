import { describe, it, expect } from 'vitest';
import {
  bookedPct,
  documentLabel,
  documentState,
  orderStatusLabel,
  slotsAvailable,
} from './portal-view';
import { FIXTURE_DOCS, FIXTURE_ORDERS, FIXTURE_SLOTS } from './fixtures';

describe('slotsAvailable', () => {
  it('subtracts booked from capacity', () => {
    expect(slotsAvailable({ capacity: 120, booked: 98 })).toBe(22);
  });

  it('never goes negative', () => {
    expect(slotsAvailable({ capacity: 120, booked: 130 })).toBe(0);
  });
});

describe('bookedPct', () => {
  it('rounds to a whole percentage and caps at 100', () => {
    expect(bookedPct({ capacity: 120, booked: 98 })).toBe(82);
    expect(bookedPct({ capacity: 120, booked: 200 })).toBe(100);
  });

  it('is zero when capacity is zero', () => {
    expect(bookedPct({ capacity: 0, booked: 10 })).toBe(0);
  });
});

describe('documentState', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  it('marks a far-off expiry as valid', () => {
    expect(documentState('2027-03-30', now)).toBe('valid');
  });
  it('marks an expiry within the window as expiring', () => {
    expect(documentState('2026-02-01', now)).toBe('expiring');
  });
  it('marks a past expiry as expired', () => {
    expect(documentState('2025-12-01', now)).toBe('expired');
  });
});

describe('labels', () => {
  it('labels document states', () => {
    expect(documentLabel('expired')).toBe('Expired');
    expect(documentLabel('expiring')).toBe('Expiring');
    expect(documentLabel('valid')).toBe('Valid');
  });
  it('labels order statuses', () => {
    expect(orderStatusLabel('confirmed')).toBe('Confirmed');
    expect(orderStatusLabel('sent')).toBe('Sent');
    expect(orderStatusLabel('draft')).toBe('Draft');
  });
});

describe('fixtures match the view model', () => {
  it('renders the demo slots and orders through the same rules', () => {
    expect(slotsAvailable(FIXTURE_SLOTS[0])).toBe(22);
    expect(orderStatusLabel(FIXTURE_ORDERS[0].status)).toBe('Sent');
    expect(documentState(FIXTURE_DOCS[0].expiresOn, new Date('2026-01-01T00:00:00Z'))).toBe('valid');
  });
});
