import type { AreaCheck, AreaQuery } from '@ag/api-client';

/**
 * A per-area cache for the delivery-area check (T-078).
 *
 * A shopper types a suburb one character at a time, and each settled value would
 * otherwise be a round trip to logistics. The cache is keyed on the normalised
 * area, so `Umhlanga`, ` umhlanga ` and `UMHLANGA` share one entry, and holds an
 * answer for a short time so a corrected typo is still fresh.
 *
 * The TTL is deliberately short: a fee or a slot can change, and a stale promise
 * is the thing this feature exists to avoid.
 */

/** How long an answer stays fresh. Short, because a fee and a slot both move. */
export const AREA_CACHE_TTL_MS = 5 * 60 * 1000;

/** The key a query caches under: the area and the goods total that sets the fee. */
export function areaCacheKey(area: AreaQuery): string {
  const postal = (area.postalCode ?? '').replace(/\D/g, '');
  const suburb = (area.suburb ?? '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  return `${postal}|${suburb}|${area.goodsTotalCents ?? ''}`;
}

/** Whether a query is worth asking: an empty area would only be told to enter one. */
export function isAskable(area: AreaQuery): boolean {
  return (area.postalCode ?? '').replace(/\D/g, '').length > 0 || (area.suburb ?? '').trim().length >= 2;
}

interface Entry {
  value: AreaCheck;
  expiresAt: number;
}

export class AreaCheckCache {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly ttlMs: number = AREA_CACHE_TTL_MS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get(area: AreaQuery): AreaCheck | undefined {
    const key = areaCacheKey(area);
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(area: AreaQuery, value: AreaCheck): AreaCheck {
    this.entries.set(areaCacheKey(area), { value, expiresAt: this.now() + this.ttlMs });
    return value;
  }

  /** The cached answer, or one fetch. A refusal is cached too: the zones do not move per keystroke. */
  async resolve(area: AreaQuery, fetchCheck: (area: AreaQuery) => Promise<AreaCheck>): Promise<AreaCheck> {
    const cached = this.get(area);
    if (cached) return cached;
    return this.set(area, await fetchCheck(area));
  }

  /** Drop an entry, so a shopper can re-ask after an area is added to a route. */
  forget(area: AreaQuery): void {
    this.entries.delete(areaCacheKey(area));
  }

  get size(): number {
    return this.entries.size;
  }
}
