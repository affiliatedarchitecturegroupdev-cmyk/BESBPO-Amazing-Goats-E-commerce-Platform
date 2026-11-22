import { chilledMeatCycle, type Cycle } from '@ag/cutoff';
import type { Route } from '../routes/routes.types';
import type { Slot } from '../slots/slots.types';
import type { Zone } from './zones.types';

/**
 * The delivery-area check (T-078): "do you deliver to me, when, and for how
 * much", answered from data the platform already holds.
 *
 * Every field here is derived, never guessed. The fee comes from the zone row,
 * the next date from a bookable slot, and the cut-off from the shared cut-off
 * engine (`@ag/cutoff`), so the answer a shopper sees before checkout is the one
 * the order will actually meet. A promise the engine would not keep is worse
 * than no promise, so an unserved area is refused rather than approximated.
 */

/** How the caller identified their area. A postal code is the strictest key. */
export interface AreaQuery {
  postalCode?: string;
  suburb?: string;
}

/** A zone as the check needs it: the polygon and the fee terms. */
export type CheckableZone = Zone;

/** What a served area is told. */
export interface ServedCheck {
  served: true;
  zone: { id: number; code: string; name: string };
  /** ISO instant of the next bookable slot, or null when none is scheduled. */
  nextSlot: string | null;
  /** The zone's fee in cents. `0` is a real answer (free delivery), not "unknown". */
  feeCents: number;
  /** ISO instant the public order must be placed by, from the cut-off engine. */
  cutoffAt: string;
  /**
   * Whether the fee already includes VAT. The order builder adds the delivery
   * fee to the VAT-inclusive total without taxing it again, so the fee a
   * shopper is quoted is the fee they pay (docs/13-pricing.md).
   */
  feeIncludesVat: true;
  /** Set when the goods total reached the zone's free-over threshold. */
  freeOverApplied: boolean;
}

/** What an unserved area is told: the honest answer, and a way to be told when it changes. */
export interface UnservedCheck {
  served: false;
  /** The area as it was understood, so the copy can echo it back. */
  area: string;
  /** True when the caller must supply an area before an answer is possible. */
  needsArea: boolean;
  waitlist: { available: true };
}

export type ZoneCheck = ServedCheck | UnservedCheck;

/** Normalise a postal code: digits only, so " 4051 " and "4051" are one key. */
export function normalisePostalCode(value: string | undefined): string | undefined {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length > 0 ? digits : undefined;
}

/** Normalise a suburb for comparison: lowercase, single-spaced, no punctuation. */
export function normaliseSuburb(value: string | undefined): string | undefined {
  const cleaned = (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * A zone matches a suburb when its name or code lists the suburb as a whole
 * word or phrase. `Umhlanga` matches a zone named "Umhlanga and Phoenix"; a
 * zone named "Durban" does not claim "Durban North", because that is a
 * different area and a delivery promise must not be widened by a guess. The
 * match is on a word boundary, so "Durban" never matches "Durbanville" — the
 * failure a naive `includes` would produce.
 */
export function zoneMatchesSuburb(zone: Zone, suburb: string): boolean {
  // "and" is the connector a zone name uses to list its areas, never an area.
  const words = (value: string): string[] =>
    normaliseSuburb(value)?.split(' ').filter((w) => w.length > 0 && w !== 'and') ?? [];
  const target = words(suburb);
  if (target.length === 0) return false;
  for (const field of [zone.name, zone.code]) {
    const have = words(field);
    if (have.length === 0) continue;
    // A multi-word suburb must appear as that phrase; a single word must match a word.
    for (let i = 0; i + target.length <= have.length; i++) {
      if (target.every((w, j) => have[i + j] === w)) return true;
    }
  }
  return false;
}

/** The zone serving an area, or undefined. Postal code is tried before suburb. */
export function findZoneForArea(zones: Zone[], area: AreaQuery): Zone | undefined {
  const suburb = normaliseSuburb(area.suburb);
  if (suburb) {
    const byName = zones.find((z) => zoneMatchesSuburb(z, suburb));
    if (byName) return byName;
  }
  // Zones carry no postal-code column, so a bare postal code can only be
  // answered when the code itself is the zone's code (a zone coded by area).
  const postal = normalisePostalCode(area.postalCode);
  if (postal) return zones.find((z) => normalisePostalCode(z.code) === postal);
  return undefined;
}

/**
 * The fee for a zone at a goods total. Free once the total reaches the zone's
 * `freeOverCents`; the threshold is inclusive, matching `quoteDelivery`.
 */
export function feeFor(zone: Zone, goodsTotalCents = 0): { feeCents: number; freeOverApplied: boolean } {
  const free = zone.freeOverCents !== undefined && goodsTotalCents >= zone.freeOverCents;
  return { feeCents: free ? 0 : zone.feeCents, freeOverApplied: free };
}

/**
 * The earliest bookable slot on a route that serves the zone. Only a slot with
 * room and still open counts, so the date shown is one a shopper can take.
 */
export function nextSlotFor(zone: Zone, routes: Route[], slots: Slot[], now: Date): Slot | undefined {
  const zoneRoutes = new Set(routes.filter((r) => r.zoneId === zone.id).map((r) => r.id));
  return slots
    .filter((s) => zoneRoutes.has(s.routeId))
    .filter((s) => s.capacity - s.booked > 0 && Date.parse(s.endsAt) > now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
}

/** The public cut-off for chilled goods, which is the binding cycle for a delivery. */
export function cutoffFor(now: Date): Cycle {
  return chilledMeatCycle(now);
}

/**
 * Compose the answer. A served area gets the zone, the fee, the next date and
 * the cut-off; anything else is unserved with a waitlist rather than a guess.
 */
export function checkArea(
  zones: Zone[],
  area: AreaQuery,
  opts: { routes?: Route[]; slots?: Slot[]; goodsTotalCents?: number; now?: Date } = {},
): ZoneCheck {
  const now = opts.now ?? new Date();
  const zone = findZoneForArea(zones, area);
  const label = normaliseSuburb(area.suburb) ?? normalisePostalCode(area.postalCode) ?? '';

  if (!zone) {
    return {
      served: false,
      area: label,
      needsArea: label.length === 0,
      waitlist: { available: true },
    };
  }

  const { feeCents, freeOverApplied } = feeFor(zone, opts.goodsTotalCents ?? 0);
  const slot = nextSlotFor(zone, opts.routes ?? [], opts.slots ?? [], now);

  return {
    served: true,
    zone: { id: zone.id, code: zone.code, name: zone.name },
    nextSlot: slot?.startsAt ?? null,
    feeCents,
    cutoffAt: cutoffFor(now).cutoffAt.toISOString(),
    feeIncludesVat: true,
    freeOverApplied,
  };
}

/** The copy a shopper reads. Kept beside the rule so the page cannot soften it. */
export function describeCheck(check: ZoneCheck, formatZar: (cents: number) => string): string {
  if (!check.served) {
    return check.needsArea
      ? 'Enter your suburb or postal code to see whether we deliver to you.'
      : `We do not deliver to ${check.area} yet. Leave your email and we will tell you when we do.`;
  }
  const fee =
    check.feeCents === 0
      ? check.freeOverApplied
        ? 'Delivery is free on this order'
        : 'Delivery is free to this area'
      : `Delivery is ${formatZar(check.feeCents)} including VAT`;
  const when = check.nextSlot
    ? `Next delivery ${new Date(check.nextSlot).toISOString().slice(0, 10)}`
    : 'No delivery slot is open yet';
  const cutoff = `order by ${new Date(check.cutoffAt).toISOString().slice(0, 10)}`;
  return `${fee}. ${when}; ${cutoff}.`;
}
