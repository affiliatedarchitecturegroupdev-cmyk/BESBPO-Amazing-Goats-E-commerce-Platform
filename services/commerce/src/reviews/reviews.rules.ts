/**
 * Reviews and ratings. `sales.reviews` existed since migration 0005 with no code
 * behind it and enforced neither business rule. The rules live here as pure
 * functions so they can be tested without a database, and the service supplies
 * the facts (does this caller have a delivered line for this variant?).
 *
 * The two acts are deliberately not the same (ADR 0013 s2):
 *
 *   Rate   (1-5, no text)  any authenticated customer or trade user
 *   Review (text, photo)   a caller with a `delivered` order line for the variant
 *
 * A rating is an opinion. A review is user-generated advertising under R146 of
 * 2010, which is why text is moderated before publication and a rating is not.
 */

export type ReviewStatus = 'pending' | 'published' | 'rejected';

/** Roles that may rate without having bought. Anyone with a customer or trade
 * identity is entitled to an opinion about a product they are considering. */
const RATING_ROLES = ['customer_household', 'trade_owner', 'trade_buyer', 'trade_accounts'];

export function mayRate(roles: string[]): boolean {
  return roles.some((role) => RATING_ROLES.includes(role));
}

export interface PurchaseFact {
  /** The order line's variant matches the review's variant. */
  variantId: string;
  orderId: string;
  orderLineId: string;
  /** The order's status; only `delivered` counts. */
  orderStatus: string;
}

/**
 * Whether the caller may write a *text* review for this variant, and under which
 * order. A `delivered` line is the only proof that the person actually received
 * the product; a shipped or in-cycle order is not, because they have not seen it
 * yet.
 *
 * Returns the most recent delivered line, so a repeat buyer reviews against a
 * real order and the unique `(user, variant, order)` key allows one per order.
 */
export function deliveredPurchaseFor(
  variantId: string,
  purchases: PurchaseFact[],
): PurchaseFact | undefined {
  return purchases
    .filter((p) => p.variantId === variantId && p.orderStatus === 'delivered')
    .sort((a, b) => a.orderLineId.localeCompare(b.orderLineId))
    .at(-1);
}

export type SubmitKind = 'rating' | 'review';

/**
 * What kind of submission this is. Text or a photo makes it a review; a bare
 * rating stays a rating. This is the single place the distinction is drawn, so
 * the two rules cannot drift apart.
 */
export function submissionKind(input: { body?: string | null; photoUrl?: string | null }): SubmitKind {
  const hasBody = typeof input.body === 'string' && input.body.trim().length > 0;
  const hasPhoto = typeof input.photoUrl === 'string' && input.photoUrl.trim().length > 0;
  return hasBody || hasPhoto ? 'review' : 'rating';
}

export interface SubmitRequest {
  variantId: string;
  rating: number;
  body?: string | null;
  photoUrl?: string | null;
}

export type SubmitDecision =
  | { allowed: true; kind: SubmitKind; verifiedPurchase: boolean; order?: PurchaseFact }
  | { allowed: false; reason: string };

/**
 * The whole submission rule. `purchases` are the caller's delivered-or-not order
 * lines for this variant; the service loads them, never the request body.
 *
 * A review without a delivered purchase is refused with a plain reason. The
 * rating bound is checked here too, so a bad number is a 400 and not a database
 * constraint violation.
 */
export function decideSubmission(
  request: SubmitRequest,
  caller: { userId: string; roles: string[] },
  purchases: PurchaseFact[],
): SubmitDecision {
  if (!Number.isInteger(request.rating) || request.rating < 1 || request.rating > 5) {
    return { allowed: false, reason: 'rating must be a whole number from 1 to 5' };
  }

  const kind = submissionKind(request);

  if (kind === 'rating') {
    if (!mayRate(caller.roles)) {
      return { allowed: false, reason: 'only a customer or trade account may rate a product' };
    }
    return { allowed: true, kind, verifiedPurchase: false };
  }

  const purchase = deliveredPurchaseFor(request.variantId, purchases);
  if (!purchase) {
    return {
      allowed: false,
      reason: 'a written review needs a delivered order for this product',
    };
  }
  return { allowed: true, kind, verifiedPurchase: true, order: purchase };
}

export interface ReviewAggregate {
  /** How many rows carried a score. */
  ratingCount: number;
  /** How many rows carried written text. */
  reviewCount: number;
  /** Mean of the scores, or null when there are none. */
  averageRating: number | null;
  /** How many of the ratings were backed by a delivered order. */
  verifiedCount: number;
}

/**
 * The aggregate reports ratings and reviews separately, because 40 ratings and
 * 2 written reviews must not be presented as 40 reviews — that is the misleading
 * shape a single "reviewCount" produces.
 *
 * Only published rows should be passed in; the caller filters.
 */
export function aggregate(rows: { rating: number | null; body: string | null; verifiedPurchase: boolean }[]): ReviewAggregate {
  const scored = rows.filter((r) => typeof r.rating === 'number');
  const written = rows.filter((r) => typeof r.body === 'string' && r.body.trim().length > 0);
  const total = scored.reduce((sum, r) => sum + (r.rating ?? 0), 0);
  return {
    ratingCount: scored.length,
    reviewCount: written.length,
    averageRating: scored.length === 0 ? null : Math.round((total / scored.length) * 10) / 10,
    verifiedCount: scored.filter((r) => r.verifiedPurchase).length,
  };
}

/** Whether a row is visible to the public. Only `published`. */
export function isPublic(status: ReviewStatus): boolean {
  return status === 'published';
}

export type ModerationAction = 'publish' | 'reject';

export type ModerationDecision =
  | { allowed: true; status: ReviewStatus }
  | { allowed: false; reason: string };

/**
 * A moderation decision. Rejection must carry a reason, because the author is
 * entitled to know why their writing is not shown (CPA s11 plain language) and a
 * silent rejection is indistinguishable from a bug.
 */
export function decideModeration(
  action: ModerationAction,
  reason: string | undefined,
): ModerationDecision {
  if (action === 'publish') return { allowed: true, status: 'published' };
  if (!reason || reason.trim().length === 0) {
    return { allowed: false, reason: 'a rejection needs a reason for the author' };
  }
  return { allowed: true, status: 'rejected' };
}
