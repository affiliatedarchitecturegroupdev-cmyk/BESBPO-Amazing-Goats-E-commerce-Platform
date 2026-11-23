import type { Route } from '../routes/routes.types';
import type { Zone } from './zones.types';

/**
 * The public delivery table (T-055): what the `/delivery` page shows a shopper
 * before they have an account.
 *
 * The zone list itself is staff-only (`routes:read`) because it carries the
 * polygons that decide where a vehicle goes. The fee, the free-over threshold
 * and the route weekday are customer-facing facts — a shopper is entitled to
 * know the cost of delivery and the day it arrives before they order — so they
 * are projected out here deliberately, and nothing else is.
 *
 * The projection is a pure function of the rows so a leaked field is a test
 * failure rather than a review question: `publicZoneTable` never copies a
 * polygon, and a route pointing at an unknown zone contributes no day.
 */

/** A zone as the public page may show it: no geometry. */
export interface PublicZone {
  code: string;
  name: string;
  feeCents: number;
  /** Null when the zone has no free-delivery threshold. */
  freeOverCents: number | null;
}

/** The weekdays a zone is served on, for the "route days" line. */
export interface PublicRouteDay {
  /** 0 = Sunday .. 6 = Saturday, matching `logistics.routes.day_of_week`. */
  dayOfWeek: number;
  day: string;
  /** Zone names served that day, in zone-code order. */
  zones: string[];
}

export interface PublicZoneTable {
  zones: PublicZone[];
  routeDays: PublicRouteDay[];
  /** The fee already includes VAT, so the quoted fee is the fee paid (docs/13-pricing.md). */
  feeIncludesVat: true;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** The weekday name for a 0..6 index, or undefined when the index is out of range. */
export function dayName(dayOfWeek: number): string | undefined {
  return Number.isInteger(dayOfWeek) ? DAY_NAMES[dayOfWeek] : undefined;
}

/** One zone, projected to its public fields. */
export function toPublicZone(zone: Zone): PublicZone {
  return {
    code: zone.code,
    name: zone.name,
    feeCents: zone.feeCents,
    freeOverCents: zone.freeOverCents ?? null,
  };
}

/**
 * The zone table plus the weekday each zone is served on. Routes are grouped by
 * weekday; a route with no zone, or one naming a zone the caller cannot see, is
 * dropped rather than shown as an unlabelled day.
 */
export function publicZoneTable(zones: Zone[], routes: Route[]): PublicZoneTable {
  const byId = new Map(zones.map((z) => [z.id, z]));
  const publicZones = [...zones]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(toPublicZone);

  const byDay = new Map<number, Set<string>>();
  for (const route of routes) {
    const zone = route.zoneId === undefined ? undefined : byId.get(route.zoneId);
    if (!zone || dayName(route.dayOfWeek) === undefined) continue;
    const names = byDay.get(route.dayOfWeek) ?? new Set<string>();
    names.add(zone.name);
    byDay.set(route.dayOfWeek, names);
  }

  const routeDays = [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([dayOfWeek, names]) => ({
      dayOfWeek,
      day: dayName(dayOfWeek)!,
      zones: [...names].sort((a, b) => a.localeCompare(b)),
    }));

  return { zones: publicZones, routeDays, feeIncludesVat: true };
}
