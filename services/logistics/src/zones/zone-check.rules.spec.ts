import { describe, it, expect } from 'vitest';
import type { Route } from '../routes/routes.types';
import type { Slot } from '../slots/slots.types';
import type { Zone } from './zones.types';
import {
  checkArea,
  describeCheck,
  feeFor,
  findZoneForArea,
  nextSlotFor,
  normalisePostalCode,
  normaliseSuburb,
  zoneMatchesSuburb,
} from './zone-check.rules';

const formatZar = (cents: number): string => `R${(cents / 100).toFixed(2)}`;

const umhlanga: Zone = { id: 1, code: 'KZN-NC-UMH', name: 'Umhlanga and Phoenix', feeCents: 7500 };
const durban: Zone = { id: 2, code: 'KZN-DBN', name: 'Durban', feeCents: 9000, freeOverCents: 100000 };
const zones = [umhlanga, durban];

const route: Route = { id: 'r1', name: 'Wed Durban', dayOfWeek: 3, zoneId: 2 };
const routes = [route];

function slot(over: Partial<Slot> = {}): Slot {
  return {
    id: 's1',
    routeId: 'r1',
    startsAt: '2026-11-18T04:00:00.000Z',
    endsAt: '2026-11-18T16:00:00.000Z',
    capacity: 20,
    booked: 5,
    earlyWindow: false,
    ...over,
  };
}

const now = new Date('2026-11-11T10:00:00Z');

describe('normalising an area', () => {
  it('keeps digits only in a postal code', () => {
    expect(normalisePostalCode(' 4051 ')).toBe('4051');
    expect(normalisePostalCode('40-51')).toBe('4051');
    expect(normalisePostalCode('')).toBeUndefined();
    expect(normalisePostalCode(undefined)).toBeUndefined();
  });

  it('lowercases and collapses a suburb', () => {
    expect(normaliseSuburb('  Umhlanga   Ridge ')).toBe('umhlanga ridge');
    expect(normaliseSuburb('St. Lucia')).toBe('st lucia');
    expect(normaliseSuburb('   ')).toBeUndefined();
  });
});

describe('matching a suburb to a zone', () => {
  it('matches a whole word inside a multi-area zone name', () => {
    expect(zoneMatchesSuburb(umhlanga, 'phoenix')).toBe(true);
    expect(zoneMatchesSuburb(umhlanga, 'umhlanga')).toBe(true);
  });

  it('matches a multi-word suburb as a phrase', () => {
    const zone: Zone = { id: 3, code: 'KZN-NC', name: 'Umhlanga Ridge and Cornubia', feeCents: 0 };
    expect(zoneMatchesSuburb(zone, 'umhlanga ridge')).toBe(true);
    expect(zoneMatchesSuburb(zone, 'ridge umhlanga')).toBe(false);
  });

  it('does not match a longer word that merely starts the same', () => {
    expect(zoneMatchesSuburb(durban, 'durbanville')).toBe(false);
  });

  it('does not widen a zone to a suburb it does not list', () => {
    // "Durban North" is its own area; a zone named "Durban" must not claim it.
    expect(zoneMatchesSuburb(durban, 'durban north')).toBe(false);
    const north: Zone = { id: 6, code: 'KZN-DBN-N', name: 'Durban North and Umhlanga', feeCents: 8000 };
    expect(zoneMatchesSuburb(north, 'durban north')).toBe(true);
  });

  it('ignores the "and" that joins a zone\'s areas', () => {
    expect(zoneMatchesSuburb(umhlanga, 'and')).toBe(false);
  });

  it('finds the zone for a suburb, and for a zone coded as the postal code', () => {
    expect(findZoneForArea(zones, { suburb: 'Umhlanga' })?.id).toBe(1);
    const coded: Zone = { id: 4, code: '4051', name: 'Durban North', feeCents: 5000 };
    expect(findZoneForArea([coded], { postalCode: '4051' })?.id).toBe(4);
  });

  it('returns undefined for an area no zone covers', () => {
    expect(findZoneForArea(zones, { suburb: 'Kimberley' })).toBeUndefined();
    expect(findZoneForArea(zones, {})).toBeUndefined();
  });
});

describe('fee', () => {
  it('charges the zone fee below the free-over threshold', () => {
    expect(feeFor(durban, 99_999)).toEqual({ feeCents: 9000, freeOverApplied: false });
  });

  it('is free at exactly the threshold, and above it', () => {
    expect(feeFor(durban, 100_000)).toEqual({ feeCents: 0, freeOverApplied: true });
    expect(feeFor(durban, 250_000)).toEqual({ feeCents: 0, freeOverApplied: true });
  });

  it('has no free threshold when the zone sets none', () => {
    expect(feeFor(umhlanga, 10_000_000)).toEqual({ feeCents: 7500, freeOverApplied: false });
  });

  it('treats a zero fee as a real fee, not a missing one', () => {
    const free: Zone = { id: 5, code: 'KZN-FREE', name: 'Free area', feeCents: 0 };
    expect(feeFor(free, 0)).toEqual({ feeCents: 0, freeOverApplied: false });
  });
});

describe('next slot', () => {
  it('takes the earliest open slot on a route that serves the zone', () => {
    const later = slot({ id: 's2', startsAt: '2026-11-25T04:00:00.000Z', endsAt: '2026-11-25T16:00:00.000Z' });
    expect(nextSlotFor(durban, routes, [later, slot()], now)?.id).toBe('s1');
  });

  it('ignores a full slot and a closed slot', () => {
    const full = slot({ id: 'full', booked: 20 });
    const closed = slot({ id: 'closed', endsAt: '2026-11-10T00:00:00.000Z' });
    expect(nextSlotFor(durban, routes, [full, closed], now)).toBeUndefined();
  });

  it('ignores a slot on a route for another zone', () => {
    const other = slot({ routeId: 'r-other' });
    expect(nextSlotFor(durban, routes, [other], now)).toBeUndefined();
  });
});

describe('the area check', () => {
  it('serves a covered suburb with fee, next slot and the engine cut-off', () => {
    const check = checkArea(zones, { suburb: 'Durban' }, { routes, slots: [slot()], now });
    expect(check.served).toBe(true);
    if (!check.served) throw new Error('expected served');
    expect(check.zone).toEqual({ id: 2, code: 'KZN-DBN', name: 'Durban' });
    expect(check.feeCents).toBe(9000);
    expect(check.nextSlot).toBe('2026-11-18T04:00:00.000Z');
    // Chilled-meat cut-off for the coming Sunday 17:00 SAST, from @ag/cutoff.
    expect(check.cutoffAt).toBe('2026-11-15T15:00:00.000Z');
    expect(check.feeIncludesVat).toBe(true);
  });

  it('applies the free-over threshold from the goods total', () => {
    const check = checkArea(zones, { suburb: 'Durban' }, { routes, slots: [slot()], now, goodsTotalCents: 150_000 });
    expect(check.served && check.feeCents).toBe(0);
    expect(check.served && check.freeOverApplied).toBe(true);
  });

  it('still serves an area with no scheduled slot, without inventing a date', () => {
    const check = checkArea(zones, { suburb: 'Durban' }, { routes, slots: [], now });
    expect(check.served).toBe(true);
    expect(check.served && check.nextSlot).toBeNull();
  });

  it('refuses an area no zone covers, and offers the waitlist', () => {
    const check = checkArea(zones, { suburb: 'Kimberley' }, { now });
    expect(check).toEqual({
      served: false,
      area: 'kimberley',
      needsArea: false,
      waitlist: { available: true },
    });
  });

  it('asks for an area when none was given', () => {
    const check = checkArea(zones, {}, { now });
    expect(check.served).toBe(false);
    expect(check.served === false && check.needsArea).toBe(true);
  });

  it('does not leak the zone table: the answer carries one zone', () => {
    const check = checkArea(zones, { suburb: 'Umhlanga' }, { now });
    expect(check.served && check.zone.code).toBe('KZN-NC-UMH');
    expect(JSON.stringify(check)).not.toContain('KZN-DBN');
  });
});

describe('the copy', () => {
  it('states the fee, the next date and the cut-off for a served area', () => {
    const check = checkArea(zones, { suburb: 'Durban' }, { routes, slots: [slot()], now });
    expect(describeCheck(check, formatZar)).toBe(
      'Delivery is R90.00 including VAT. Next delivery 2026-11-18; order by 2026-11-15.',
    );
  });

  it('says free, and why, when the threshold was met', () => {
    const check = checkArea(zones, { suburb: 'Durban' }, { routes, slots: [slot()], now, goodsTotalCents: 150_000 });
    expect(describeCheck(check, formatZar)).toContain('Delivery is free on this order');
  });

  it('does not promise a date when no slot is open', () => {
    const check = checkArea(zones, { suburb: 'Durban' }, { routes, slots: [], now });
    expect(describeCheck(check, formatZar)).toContain('No delivery slot is open yet');
  });

  it('is honest for an unserved area and asks for an area when missing', () => {
    expect(describeCheck(checkArea(zones, { suburb: 'Kimberley' }, { now }), formatZar)).toBe(
      'We do not deliver to kimberley yet. Leave your email and we will tell you when we do.',
    );
    expect(describeCheck(checkArea(zones, {}, { now }), formatZar)).toContain('Enter your suburb');
  });
});
