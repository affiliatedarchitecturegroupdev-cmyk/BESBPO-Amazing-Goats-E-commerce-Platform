import type { AreaCheck } from '@ag/api-client';
import { formatRand } from './format';

/**
 * The delivery-area check as the page shows it (T-078).
 *
 * The copy lives here, as a pure function of the answer, so the product page and
 * the cart say the same thing and neither can soften a refusal. The rule itself
 * is the service's (`services/logistics/src/zones/zone-check.rules.ts`); this
 * only formats it for a shopper.
 */

export interface AreaCheckView {
  tone: 'served' | 'unserved' | 'needs-area';
  headline: string;
  detail: string;
  /** The zone's name, when the area is served. */
  zoneName?: string;
}

/** A date as a shopper reads it: `Wed 18 Nov`, in South African time. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Johannesburg',
  });
}

/** The delivery fee, always stated with its VAT position (docs/13-pricing.md). */
export function feeLine(feeCents: number, feeIncludesVat: boolean): string {
  if (feeCents === 0) return 'Free delivery';
  return `${formatRand(feeCents)} delivery${feeIncludesVat ? ' (incl. VAT)' : ' (excl. VAT)'}`;
}

/** Turn the service's answer into the words and tone the page renders. */
export function areaCheckView(check: AreaCheck): AreaCheckView {
  if (!check.served) {
    if (check.needsArea) {
      return {
        tone: 'needs-area',
        headline: 'Check delivery to your area',
        detail: 'Enter your suburb or postal code to see whether we deliver to you, when, and for how much.',
      };
    }
    return {
      tone: 'unserved',
      headline: `We do not deliver to ${check.area} yet`,
      detail: 'Leave your email and we will tell you as soon as your area is on a route. No order is placed.',
    };
  }

  const fee = feeLine(check.feeCents, check.feeIncludesVat);
  const freeNote = check.freeOverApplied ? ' — your order qualifies for free delivery' : '';
  const when = check.nextSlot
    ? `Next delivery ${shortDate(check.nextSlot)}`
    : 'No delivery slot is open yet';
  const cutoff = `order by ${shortDate(check.cutoffAt)}`;

  return {
    tone: 'served',
    headline: `We deliver to ${check.zone.name}`,
    detail: `${fee}${freeNote}. ${when}; ${cutoff}.`,
    zoneName: check.zone.name,
  };
}
