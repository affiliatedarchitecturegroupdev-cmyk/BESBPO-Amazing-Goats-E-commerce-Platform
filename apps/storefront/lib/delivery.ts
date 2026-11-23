import type { PublicRouteDay, PublicZone, PublicZoneTable } from '@ag/api-client';
import { formatRand } from './format';

/**
 * The delivery page's view of the zone table (T-055, wireframe `sf-delivery`).
 *
 * The service decides the fee and the free-over threshold; this module only
 * states them. Two rules it does enforce, because both are ways a page misleads:
 *
 *  - A fee is always shown with its VAT position, never as a bare amount.
 *  - A route day with no zones is dropped, so "Thursday: nothing" cannot appear
 *    as if it were a delivery day.
 */

export interface ZoneRow {
  code: string;
  name: string;
  /** The fee as a shopper reads it: `Free delivery` or `R85.00`. */
  fee: string;
  /** The free-over line, or undefined when the zone has no threshold. */
  freeOver?: string;
  /** True when the zone itself charges nothing. */
  free: boolean;
}

export interface RouteDayRow {
  day: string;
  zones: string;
}

/** The fee copy for one zone, with the VAT position stated once per row. */
export function zoneFee(zone: PublicZone, feeIncludesVat: boolean): string {
  if (zone.feeCents === 0) return 'Free delivery';
  return `${formatRand(zone.feeCents)}${feeIncludesVat ? ' incl. VAT' : ' excl. VAT'}`;
}

/** One zone row, ready to render. */
export function zoneRow(zone: PublicZone, feeIncludesVat: boolean): ZoneRow {
  return {
    code: zone.code,
    name: zone.name,
    fee: zoneFee(zone, feeIncludesVat),
    freeOver:
      zone.freeOverCents != null && zone.freeOverCents > 0
        ? `Free over ${formatRand(zone.freeOverCents)}`
        : undefined,
    free: zone.feeCents === 0,
  };
}

/** The zone rows, in the order the service returned them. */
export function zoneRows(table: PublicZoneTable): ZoneRow[] {
  return table.zones.map((zone) => zoneRow(zone, table.feeIncludesVat));
}

/** The route days, dropping any day that names no zone. */
export function routeDayRows(days: PublicRouteDay[]): RouteDayRow[] {
  return days
    .filter((d) => d.zones.length > 0)
    .map((d) => ({ day: d.day, zones: d.zones.join(', ') }));
}

/**
 * The route-day summary line the wireframe shows ("Route days: Mon North Coast,
 * Tue South Coast, ..."), built from the table rather than hard-coded copy, so it
 * cannot drift from what the service will actually deliver.
 */
export function routeDaySummary(days: PublicRouteDay[]): string {
  const rows = routeDayRows(days);
  if (rows.length === 0) return 'No route days are scheduled yet.';
  return rows.map((r) => `${r.day}: ${r.zones}`).join(' · ');
}

/** An empty table is not an error; it means no zones are configured yet. */
export function isEmptyTable(table: PublicZoneTable): boolean {
  return table.zones.length === 0;
}
