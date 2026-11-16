import type { Money } from '@ag/shared-types';

/** The shapes a promotion takes, matching sales.promotions.kind. */
export const PROMOTION_KINDS = ['percent', 'amount', 'bundle_price', 'free_delivery'] as const;
export type PromotionKind = (typeof PROMOTION_KINDS)[number];

/**
 * A promotion is created as a draft, approved by a second person, then runs for
 * its window. `ended` is set once it is retired.
 */
export type PromotionStatus = 'draft' | 'approved' | 'ended';

export interface Promotion {
  id: string;
  code: string;
  name: string;
  kind: PromotionKind;
  /** For `amount` and `bundle_price`: integer cents. */
  valueCents?: Money;
  /** For `percent`: a whole or fractional percentage, 0..100. */
  percent?: number;
  /** ISO timestamps; the window is half-open `[startsAt, endsAt)`. */
  startsAt: string;
  endsAt: string | null;
  status: PromotionStatus;
  /** When true the promotion may combine with others; a non-stackable one runs alone. */
  stackable: boolean;
  /** Order subtotal (excluding VAT) that must be met, in cents. */
  minSpendCents?: Money;
  /** Limits the promotion to these SKUs; absent means the whole cart. */
  skus?: string[];
  /** Caps how many times one customer may use it. */
  maxUsesPerCustomer?: number;
  approvedBy?: string;
}

/** One cart line the engine prices, in integer cents excluding VAT. */
export interface PromotionLine {
  sku: string;
  qty: number;
  unitPriceExVatCents: Money;
}

export interface PromotionCart {
  lines: PromotionLine[];
  /** How many times this customer has already used each promotion code. */
  customerUses?: Record<string, number>;
}

/** A discount the engine applied, and the money it took off. */
export interface AppliedDiscount {
  code: string;
  kind: PromotionKind;
  /** Integer cents removed from the goods subtotal. */
  amountCents: Money;
  /** Set when the promotion waives the delivery fee instead of the goods total. */
  freeDelivery: boolean;
  /** The SKUs the discount touched; empty when it applies to the whole cart. */
  skus: string[];
}

export interface PromotionResult {
  /** Subtotal before discounts, integer cents. */
  subtotalExVatCents: Money;
  /** Total goods discount, integer cents (never more than the subtotal). */
  discountCents: Money;
  /** Subtotal after goods discounts, integer cents. */
  discountedSubtotalExVatCents: Money;
  /** True when any applied promotion waives delivery. */
  freeDelivery: boolean;
  applied: AppliedDiscount[];
  /** Why each promotion did not apply, for the admin and support view. */
  rejected: { code: string; reason: string }[];
}
