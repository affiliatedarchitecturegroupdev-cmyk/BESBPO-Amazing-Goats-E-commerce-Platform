import { describe, it, expect } from 'vitest';
import {
  isEmptyTable,
  routeDayRows,
  routeDaySummary,
  zoneFee,
  zoneRow,
  zoneRows,
} from './delivery';
import { formatRand } from './format';
import type { PublicZone, PublicZoneTable } from '@ag/api-client';

const zone = (over: Partial<PublicZone> = {}): PublicZone => ({
  code: '1',
  name: 'Within 30 km',
  feeCents: 0,
  freeOverCents: null,
  ...over,
});

const table = (over: Partial<PublicZoneTable> = {}): PublicZoneTable => ({
  zones: [],
  routeDays: [],
  feeIncludesVat: true,
  ...over,
});

describe('zoneFee', () => {
  it('says free when the zone charges nothing, without a currency amount', () => {
    expect(zoneFee(zone({ feeCents: 0 }), true)).toBe('Free delivery');
  });

  it('states the fee with its VAT position', () => {
    expect(zoneFee(zone({ feeCents: 8500 }), true)).toBe('R85,00 incl. VAT');
    expect(zoneFee(zone({ feeCents: 8500 }), false)).toBe('R85,00 excl. VAT');
  });

  it('formats a large fee with thousands separators', () => {
    expect(zoneFee(zone({ feeCents: 125000 }), true)).toBe(`${formatRand(125000)} incl. VAT`);
  });
});

describe('zoneRow', () => {
  it('carries the free-over threshold when the zone has one', () => {
    const row = zoneRow(zone({ feeCents: 8500, freeOverCents: 100000 }), true);
    expect(row.freeOver).toBe(`Free over ${formatRand(100000)}`);
    expect(row.free).toBe(false);
  });

  it('omits the free-over line when the threshold is null', () => {
    expect(zoneRow(zone({ freeOverCents: null }), true).freeOver).toBeUndefined();
  });

  it('omits a zero free-over threshold rather than promising free delivery over R0', () => {
    expect(zoneRow(zone({ freeOverCents: 0 }), true).freeOver).toBeUndefined();
  });

  it('flags a free zone', () => {
    expect(zoneRow(zone({ feeCents: 0 }), true).free).toBe(true);
  });
});

describe('zoneRows', () => {
  it('maps every zone, in order', () => {
    const rows = zoneRows(
      table({
        zones: [zone({ code: '1' }), zone({ code: '2', name: 'Durban', feeCents: 8500 })],
      }),
    );
    expect(rows.map((r) => r.code)).toEqual(['1', '2']);
  });

  it('is empty for an empty table', () => {
    expect(zoneRows(table())).toEqual([]);
  });
});

describe('routeDayRows', () => {
  it('joins the zones served on a day', () => {
    const rows = routeDayRows([{ dayOfWeek: 1, day: 'Monday', zones: ['North Coast', 'Local'] }]);
    expect(rows).toEqual([{ day: 'Monday', zones: 'North Coast, Local' }]);
  });

  it('drops a day with no zones instead of showing an empty delivery day', () => {
    const rows = routeDayRows([
      { dayOfWeek: 1, day: 'Monday', zones: [] },
      { dayOfWeek: 3, day: 'Wednesday', zones: ['Durban'] },
    ]);
    expect(rows.map((r) => r.day)).toEqual(['Wednesday']);
  });
});

describe('routeDaySummary', () => {
  it('builds the summary line from the table', () => {
    const summary = routeDaySummary([
      { dayOfWeek: 1, day: 'Monday', zones: ['North Coast'] },
      { dayOfWeek: 3, day: 'Wednesday', zones: ['Durban'] },
    ]);
    expect(summary).toBe('Monday: North Coast · Wednesday: Durban');
  });

  it('says so when nothing is scheduled rather than showing a blank line', () => {
    expect(routeDaySummary([])).toBe('No route days are scheduled yet.');
  });
});

describe('isEmptyTable', () => {
  it('is true when no zones are configured', () => {
    expect(isEmptyTable(table())).toBe(true);
  });

  it('is false when a zone exists', () => {
    expect(isEmptyTable(table({ zones: [zone()] }))).toBe(false);
  });
});
