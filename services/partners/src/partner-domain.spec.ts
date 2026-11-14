import { describe, it, expect } from 'vitest';
import {
  canConfirmSlot,
  confirmSlot,
  documentState,
  scopeToOrg,
  slotsAvailable,
  type PartnerDocument,
  type SlaughterSlot,
} from './partner-domain';

const slot = (over: Partial<SlaughterSlot> = {}): SlaughterSlot => ({
  id: 'slot-1',
  orgId: 'org-1',
  date: 'Mon',
  capacity: 120,
  booked: 98,
  confirmed: false,
  halaal: true,
  ...over,
});

describe('scopeToOrg', () => {
  it('returns only rows owned by the org', () => {
    const rows = [
      { orgId: 'org-1', id: 'a' },
      { orgId: 'org-2', id: 'b' },
      { orgId: 'org-1', id: 'c' },
    ];
    expect(scopeToOrg(rows, 'org-1').map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('returns nothing for an org with no rows', () => {
    expect(scopeToOrg([{ orgId: 'org-1', id: 'a' }], 'org-9')).toEqual([]);
  });
});

describe('slotsAvailable', () => {
  it('subtracts booked from capacity', () => {
    expect(slotsAvailable({ capacity: 120, booked: 98 })).toBe(22);
  });

  it('never goes negative when a slot is overbooked', () => {
    expect(slotsAvailable({ capacity: 120, booked: 130 })).toBe(0);
  });
});

describe('canConfirmSlot', () => {
  it('allows a fresh slot that is not overbooked', () => {
    expect(canConfirmSlot(slot())).toEqual({ ok: true });
  });

  it('refuses a slot that is already confirmed', () => {
    expect(canConfirmSlot(slot({ confirmed: true }))).toEqual({ ok: false, reason: 'already confirmed' });
  });

  it('refuses an overbooked slot', () => {
    expect(canConfirmSlot(slot({ booked: 121 }))).toEqual({ ok: false, reason: 'overbooked' });
  });
});

describe('confirmSlot', () => {
  it('returns a confirmed copy without mutating the input', () => {
    const original = slot();
    const confirmed = confirmSlot(original);
    expect(confirmed.confirmed).toBe(true);
    expect(original.confirmed).toBe(false);
  });
});

describe('documentState', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('marks a far-off expiry as valid', () => {
    expect(documentState('2027-03-30', now)).toBe('valid');
  });

  it('marks an expiry within the warning window as expiring', () => {
    expect(documentState('2026-02-01', now)).toBe('expiring');
  });

  it('marks a past expiry as expired', () => {
    expect(documentState('2025-12-01', now)).toBe('expired');
  });
});

describe('PartnerDocument shape', () => {
  it('carries the fields the portal shows', () => {
    const doc: PartnerDocument = { id: 'd1', orgId: 'org-1', name: 'Halaal certificate', expiresOn: '2027-01-12' };
    expect(doc.name).toContain('Halaal');
  });
});
