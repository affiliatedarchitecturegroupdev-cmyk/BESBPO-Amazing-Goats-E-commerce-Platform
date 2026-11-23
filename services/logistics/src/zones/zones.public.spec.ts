import { describe, it, expect } from 'vitest';
import { dayName, publicZoneTable, toPublicZone } from './zones.public';
import type { Route } from '../routes/routes.types';
import type { Zone } from './zones.types';

const zone = (over: Partial<Zone> = {}): Zone => ({
  id: 1,
  code: '1',
  name: 'Within 30 km',
  feeCents: 0,
  polygon: [{ lat: -29.8, lng: 31.0 }, { lat: -29.9, lng: 31.0 }, { lat: -29.9, lng: 31.1 }],
  ...over,
});

const route = (over: Partial<Route> = {}): Route => ({
  id: 'r1',
  name: 'North Coast',
  dayOfWeek: 1,
  zoneId: 1,
  ...over,
});

describe('dayName', () => {
  it('names the seven weekdays', () => {
    expect(dayName(0)).toBe('Sunday');
    expect(dayName(3)).toBe('Wednesday');
    expect(dayName(6)).toBe('Saturday');
  });

  it('refuses an index outside the week', () => {
    expect(dayName(7)).toBeUndefined();
    expect(dayName(-1)).toBeUndefined();
    expect(dayName(1.5)).toBeUndefined();
  });
});

describe('toPublicZone', () => {
  it('keeps the fee and the free-over threshold', () => {
    expect(toPublicZone(zone({ code: '2', feeCents: 8500, freeOverCents: 100000 }))).toEqual({
      code: '2',
      name: 'Within 30 km',
      feeCents: 8500,
      freeOverCents: 100000,
    });
  });

  it('never copies the polygon', () => {
    const result = toPublicZone(zone());
    expect(result).not.toHaveProperty('polygon');
    expect(JSON.stringify(result)).not.toContain('lat');
  });

  it('reports a missing free-over threshold as null, not undefined', () => {
    expect(toPublicZone(zone()).freeOverCents).toBeNull();
  });

  it('keeps a zero fee, which is a real answer', () => {
    expect(toPublicZone(zone({ feeCents: 0 })).feeCents).toBe(0);
  });
});

describe('publicZoneTable', () => {
  const zones = [
    zone({ id: 1, code: '1', name: 'Within 30 km', feeCents: 0 }),
    zone({ id: 2, code: '2', name: 'Durban and Pietermaritzburg', feeCents: 8500 }),
    zone({ id: 3, code: '3', name: 'Coasts', feeCents: 12500 }),
  ];

  it('orders the zones by code', () => {
    const table = publicZoneTable([zones[2], zones[0], zones[1]], []);
    expect(table.zones.map((z) => z.code)).toEqual(['1', '2', '3']);
  });

  it('groups the route days with the zones served that day', () => {
    const table = publicZoneTable(zones, [
      route({ id: 'r1', dayOfWeek: 1, zoneId: 3, name: 'North Coast' }),
      route({ id: 'r2', dayOfWeek: 3, zoneId: 2, name: 'Durban' }),
      route({ id: 'r3', dayOfWeek: 1, zoneId: 1, name: 'Local' }),
    ]);
    expect(table.routeDays).toEqual([
      { dayOfWeek: 1, day: 'Monday', zones: ['Coasts', 'Within 30 km'] },
      { dayOfWeek: 3, day: 'Wednesday', zones: ['Durban and Pietermaritzburg'] },
    ]);
  });

  it('orders the days from Sunday to Saturday', () => {
    const table = publicZoneTable(zones, [
      route({ id: 'r1', dayOfWeek: 4, zoneId: 1 }),
      route({ id: 'r2', dayOfWeek: 1, zoneId: 1 }),
    ]);
    expect(table.routeDays.map((d) => d.day)).toEqual(['Monday', 'Thursday']);
  });

  it('collapses two routes to the same zone on one day into one entry', () => {
    const table = publicZoneTable(zones, [
      route({ id: 'r1', dayOfWeek: 1, zoneId: 1 }),
      route({ id: 'r2', dayOfWeek: 1, zoneId: 1 }),
    ]);
    expect(table.routeDays).toEqual([{ dayOfWeek: 1, day: 'Monday', zones: ['Within 30 km'] }]);
  });

  it('drops a route naming a zone the caller cannot see', () => {
    const table = publicZoneTable(zones, [route({ id: 'r1', dayOfWeek: 1, zoneId: 99 })]);
    expect(table.routeDays).toEqual([]);
  });

  it('drops a route with no zone rather than showing an unlabelled day', () => {
    const table = publicZoneTable(zones, [route({ id: 'r1', dayOfWeek: 1, zoneId: undefined })]);
    expect(table.routeDays).toEqual([]);
  });

  it('drops a route with an impossible weekday', () => {
    const table = publicZoneTable(zones, [route({ id: 'r1', dayOfWeek: 9, zoneId: 1 })]);
    expect(table.routeDays).toEqual([]);
  });

  it('states the VAT position of the fee once, at the table', () => {
    expect(publicZoneTable(zones, []).feeIncludesVat).toBe(true);
  });

  it('carries no geometry anywhere in the payload', () => {
    const table = publicZoneTable(zones, [route()]);
    expect(JSON.stringify(table)).not.toContain('polygon');
    expect(JSON.stringify(table)).not.toContain('"lat"');
  });
});
