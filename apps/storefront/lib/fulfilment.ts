import type { FulfilmentType } from '@ag/shared-types';

/** Which service class a fulfilment type belongs to; drives the cut-off banner. */
export function productClass(t: FulfilmentType): string {
  return t === 'in_stock' ? 'stocked' : 'cycle';
}

export const DEFAULT_CUTOFF = 'Sunday 17:00';
export const DEFAULT_ROUTE_DAY = 'Wednesday';
export const EARLY_WINDOW = '04:00 to 07:00';

/** The standing cut-off banner copy for a product class. */
export function cutoffMessage(productClassValue: string): string {
  return productClassValue === 'stocked'
    ? 'In stock now, delivered on the next route day'
    : `Order by ${DEFAULT_CUTOFF} for ${DEFAULT_ROUTE_DAY} delivery`;
}

/** Does this fulfilment type belong to the weekly cut-off cycle? */
export function isCycleFulfilment(t: FulfilmentType): boolean {
  return t === 'pre_order_cycle' || t === 'seasonal_pre_order';
}

/** Standing-order copy for the bakery and caterer programme. */
export function earlyWindowMessage(): string {
  return `Early delivery ${EARLY_WINDOW} · standing orders`;
}
