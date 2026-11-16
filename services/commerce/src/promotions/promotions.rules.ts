import {
  AppliedDiscount,
  Promotion,
  PromotionCart,
  PromotionLine,
  PromotionResult,
} from './promotions.types';

/** Raised when a promotion transition is not allowed. */
export class PromotionError extends Error {}

/** Round half-up to whole cents. */
function roundCents(value: number): number {
  return Math.round(value + Number.EPSILON);
}

/** Goods subtotal in integer cents, ignoring VAT (the engine runs on ex-VAT prices). */
export function subtotalCents(lines: PromotionLine[]): number {
  return lines.reduce((sum, l) => sum + roundCents(l.unitPriceExVatCents * l.qty), 0);
}

/** A promotion is live when it is approved and `at` falls inside `[startsAt, endsAt)`. */
export function isActive(promotion: Promotion, at: Date): boolean {
  if (promotion.status !== 'approved') return false;
  const t = at.getTime();
  if (t < Date.parse(promotion.startsAt)) return false;
  if (promotion.endsAt && t >= Date.parse(promotion.endsAt)) return false;
  return true;
}

/** A promotion with no `skus` covers the whole cart; otherwise only those SKUs. */
export function appliesToSku(promotion: Promotion, sku: string): boolean {
  return !promotion.skus || promotion.skus.includes(sku);
}

/** The lines a promotion may discount. */
export function eligibleLines(promotion: Promotion, lines: PromotionLine[]): PromotionLine[] {
  return lines.filter((l) => appliesToSku(promotion, l.sku));
}

/** The value of the lines a promotion may discount, in integer cents. */
export function eligibleTotalCents(promotion: Promotion, lines: PromotionLine[]): number {
  return subtotalCents(eligibleLines(promotion, lines));
}

/**
 * The goods discount a promotion takes off its eligible total. `free_delivery`
 * never touches the goods total, so it returns 0 here. Every kind is capped at
 * the eligible total, so a promotion can never drive a line below zero.
 */
export function goodsDiscountCents(promotion: Promotion, eligibleTotal: number): number {
  switch (promotion.kind) {
    case 'percent': {
      const pct = promotion.percent ?? 0;
      return Math.min(eligibleTotal, roundCents((eligibleTotal * pct) / 100));
    }
    case 'amount':
      return Math.min(eligibleTotal, Math.max(0, promotion.valueCents ?? 0));
    case 'bundle_price':
      return Math.max(0, eligibleTotal - Math.max(0, promotion.valueCents ?? 0));
    case 'free_delivery':
      return 0;
  }
}

/** Why a promotion cannot apply, or null when it can. */
function ineligibilityReason(
  promotion: Promotion,
  cart: PromotionCart,
  at: Date,
  subtotal: number,
): string | null {
  if (!isActive(promotion, at)) return 'not_active';
  if (promotion.minSpendCents != null && subtotal < promotion.minSpendCents) return 'below_min_spend';
  const uses = cart.customerUses?.[promotion.code] ?? 0;
  if (promotion.maxUsesPerCustomer != null && uses >= promotion.maxUsesPerCustomer) {
    return 'usage_limit_reached';
  }
  if (eligibleLines(promotion, cart.lines).length === 0) return 'no_eligible_lines';
  return null;
}

/** Rank promotions for the single-winner case: most goods discount, then free delivery. */
function better(a: Promotion, b: Promotion, cart: PromotionCart): Promotion {
  const da = goodsDiscountCents(a, eligibleTotalCents(a, cart.lines));
  const db = goodsDiscountCents(b, eligibleTotalCents(b, cart.lines));
  if (da !== db) return da > db ? a : b;
  if (a.kind === 'free_delivery' && b.kind !== 'free_delivery') return a;
  return b;
}

/**
 * Apply promotions to a cart and return the money result. A non-stackable
 * ("exclusive") promotion runs alone: when one applies, the best is chosen and
 * the rest are reported rejected. Stackable promotions all apply together. The
 * total goods discount never exceeds the subtotal, so the payable goods amount
 * is never negative. Ties and ordering are deterministic.
 */
export function applyPromotions(
  cart: PromotionCart,
  promotions: Promotion[],
  at: Date,
): PromotionResult {
  const subtotalExVatCents = subtotalCents(cart.lines);
  const rejected: { code: string; reason: string }[] = [];
  const candidates: Promotion[] = [];

  for (const promotion of promotions) {
    const reason = ineligibilityReason(promotion, cart, at, subtotalExVatCents);
    if (reason) rejected.push({ code: promotion.code, reason });
    else candidates.push(promotion);
  }

  const exclusive = candidates.filter((p) => !p.stackable);
  let chosen: Promotion[];
  if (exclusive.length > 0) {
    const winner = exclusive.reduce((best, p) => better(best, p, cart));
    chosen = [winner];
    for (const p of candidates) {
      if (p !== winner) rejected.push({ code: p.code, reason: 'superseded_by_exclusive' });
    }
  } else {
    chosen = candidates;
  }

  const applied: AppliedDiscount[] = [];
  let remaining = subtotalExVatCents;
  let freeDelivery = false;

  for (const promotion of chosen) {
    const eligible = eligibleTotalCents(promotion, cart.lines);
    const wanted = goodsDiscountCents(promotion, eligible);
    const amountCents = Math.min(wanted, remaining);
    remaining -= amountCents;
    if (promotion.kind === 'free_delivery') freeDelivery = true;
    applied.push({
      code: promotion.code,
      kind: promotion.kind,
      amountCents,
      freeDelivery: promotion.kind === 'free_delivery',
      skus: promotion.skus ?? [],
    });
  }

  const discountCents = subtotalExVatCents - remaining;
  return {
    subtotalExVatCents,
    discountCents,
    discountedSubtotalExVatCents: remaining,
    freeDelivery,
    applied,
    rejected,
  };
}

/** Approve a draft promotion; the approver is recorded for the audit trail. */
export function approvePromotion(promotion: Promotion, approverUserId: string): Promotion {
  if (promotion.status !== 'draft') {
    throw new PromotionError(`only a draft can be approved, this promotion is ${promotion.status}`);
  }
  if (!approverUserId) throw new PromotionError('an approver is required');
  assertValidPromotion(promotion);
  return { ...promotion, status: 'approved', approvedBy: approverUserId };
}

/** Retire a promotion so it stops applying even inside its window. */
export function endPromotion(promotion: Promotion): Promotion {
  if (promotion.status !== 'approved') {
    throw new PromotionError(`only an approved promotion can be ended, this promotion is ${promotion.status}`);
  }
  return { ...promotion, status: 'ended' };
}

/** A promotion needs a code, a valid window and a value that matches its kind. */
export function assertValidPromotion(promotion: Promotion): void {
  if (!promotion.code) throw new PromotionError('a promotion needs a code');
  if (!promotion.startsAt || Number.isNaN(Date.parse(promotion.startsAt))) {
    throw new PromotionError(`promotion ${promotion.code} needs a valid startsAt`);
  }
  if (promotion.endsAt && Date.parse(promotion.endsAt) <= Date.parse(promotion.startsAt)) {
    throw new PromotionError(`promotion ${promotion.code} ends before it starts`);
  }
  if (promotion.kind === 'percent') {
    const pct = promotion.percent;
    if (pct == null || pct <= 0 || pct > 100) {
      throw new PromotionError(`promotion ${promotion.code} needs a percent between 0 and 100`);
    }
  }
  if (promotion.kind === 'amount' || promotion.kind === 'bundle_price') {
    const value = promotion.valueCents;
    if (value == null || !Number.isInteger(value) || value < 0) {
      throw new PromotionError(`promotion ${promotion.code} needs a non-negative integer valueCents`);
    }
  }
}
