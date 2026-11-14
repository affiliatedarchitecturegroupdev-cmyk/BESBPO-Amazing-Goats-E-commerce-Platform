import { PriceList, PriceListAudience, PriceListItem, ResolvedPrice } from './pricing.types';
import { VAT_RATE_PERCENT, vatBreakdown } from './vat';

/** Raised when a price-list transition is not allowed. */
export class PricingError extends Error {}

/** A list is live when it is published and `at` falls inside its validity window. */
export function isActive(list: PriceList, at: Date): boolean {
  if (list.status !== 'published') return false;
  const t = at.getTime();
  if (t < Date.parse(list.validFrom)) return false;
  // validTo is exclusive: the list stops being live at the instant it expires.
  if (list.validTo && t >= Date.parse(list.validTo)) return false;
  return true;
}

/**
 * The live list for an audience: the active one that started most recently.
 * Returns null when the audience has no live list, so the caller can fall back
 * (for example to the public list) rather than guess a price.
 */
export function activeListFor(lists: PriceList[], audience: PriceListAudience, at: Date): PriceList | null {
  const candidates = lists
    .filter((l) => l.audience === audience && isActive(l, at))
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  return candidates[0] ?? null;
}

export function itemFor(list: PriceList, sku: string): PriceListItem | null {
  return list.items.find((i) => i.sku === sku) ?? null;
}

/** Resolve one SKU's price for an audience, or null when no live list prices it. */
export function resolvePrice(
  lists: PriceList[],
  audience: PriceListAudience,
  sku: string,
  at: Date,
  ratePercent: number = VAT_RATE_PERCENT,
): ResolvedPrice | null {
  const list = activeListFor(lists, audience, at);
  if (!list) return null;
  const item = itemFor(list, sku);
  if (!item) return null;
  const b = vatBreakdown(item.priceExVatCents, ratePercent);
  return {
    sku,
    priceListCode: list.code,
    audience,
    priceExVatCents: item.priceExVatCents,
    vatCents: b.vatCents,
    priceIncVatCents: b.incVatCents,
    unitPriceBasis: item.unitPriceBasis,
  };
}

/**
 * Resolve many SKUs for one audience. The audience list is read once, so every
 * price comes from the same list version even if `at` is on a boundary.
 * SKUs the live list does not carry are omitted.
 */
export function resolvePrices(
  lists: PriceList[],
  audience: PriceListAudience,
  skus: string[],
  at: Date,
  ratePercent: number = VAT_RATE_PERCENT,
): Record<string, ResolvedPrice> {
  const out: Record<string, ResolvedPrice> = {};
  for (const sku of skus) {
    const price = resolvePrice(lists, audience, sku, at, ratePercent);
    if (price) out[sku] = price;
  }
  return out;
}

/** Prices are integer cents and never negative. */
export function assertValidItem(item: PriceListItem): void {
  if (!item.sku) throw new PricingError('price list item needs a sku');
  if (!Number.isInteger(item.priceExVatCents) || item.priceExVatCents < 0) {
    throw new PricingError(`price for ${item.sku} must be a non-negative integer number of cents`);
  }
}

/** Draft to pending approval. An empty list cannot be sent for approval. */
export function submitForApproval(list: PriceList, requestedBy: string): PriceList {
  if (list.status !== 'draft') {
    throw new PricingError(`only a draft can be submitted, this list is ${list.status}`);
  }
  if (!requestedBy) throw new PricingError('a requester is required');
  if (list.items.length === 0) throw new PricingError('cannot submit an empty price list');
  list.items.forEach(assertValidItem);
  return { ...list, status: 'pending_approval', requestedBy };
}

/**
 * Publish a submitted list. Two-person approval: the publisher must differ from
 * the requester, so no one can approve their own price change.
 */
export function publish(list: PriceList, approverUserId: string, at: Date): PriceList {
  if (list.status !== 'pending_approval') {
    throw new PricingError(`only a submitted list can be published, this list is ${list.status}`);
  }
  if (!approverUserId) throw new PricingError('an approver is required');
  if (list.requestedBy && list.requestedBy === approverUserId) {
    throw new PricingError('a price list needs a second approver: the publisher must not be the requester');
  }
  list.items.forEach(assertValidItem);
  return { ...list, status: 'published', approvedBy: approverUserId, publishedAt: at.toISOString() };
}

/**
 * Once `published` goes live, mark every other published list for the same
 * audience superseded, so only one list per audience is ever live.
 */
export function supersedeOthers(lists: PriceList[], published: PriceList): PriceList[] {
  return lists.map((l) =>
    l.id !== published.id && l.audience === published.audience && l.status === 'published'
      ? { ...l, status: 'superseded' as const }
      : l,
  );
}
