import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type ModerationAction,
  type ReviewAggregate,
  type ReviewStatus,
  type SubmitRequest,
  aggregate,
  decideModeration,
  decideSubmission,
} from './reviews.rules';
import type { Review, ReviewStore } from './reviews.store';

export const REVIEW_STORE = Symbol('REVIEW_STORE');
export const REVIEW_AUDIT = Symbol('REVIEW_AUDIT');

/** A moderation decision is recorded, because "why is my review not showing?"
 * must have an answer and a decision that leaves no trace is not reviewable. */
export interface ReviewAuditStore {
  append(entry: {
    reviewId: string;
    action: ModerationAction;
    by: string;
    reason?: string;
    at: string;
  }): Promise<void>;
  entries(): Promise<
    { reviewId: string; action: ModerationAction; by: string; reason?: string; at: string }[]
  >;
}

export class InMemoryReviewAudit implements ReviewAuditStore {
  private readonly rows: {
    reviewId: string;
    action: ModerationAction;
    by: string;
    reason?: string;
    at: string;
  }[] = [];

  async append(entry: {
    reviewId: string;
    action: ModerationAction;
    by: string;
    reason?: string;
    at: string;
  }): Promise<void> {
    this.rows.push(entry);
  }

  async entries() {
    return [...this.rows];
  }
}

/** The refusal a caller sees when the rule says no. 403 with a plain reason, so
 * the person learns what would let them write the review rather than being told
 * "forbidden". */
export class ReviewNotAllowedError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

export interface ReviewList {
  reviews: Review[];
  aggregate: ReviewAggregate;
}

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(REVIEW_STORE) private readonly store: ReviewStore,
    @Inject(REVIEW_AUDIT) private readonly audit: ReviewAuditStore,
  ) {}

  /**
   * Creates a rating or a review. `verifiedPurchase` and the order ids are set
   * here from what the store read out of `sales.order_lines` — never from the
   * request body, so a caller cannot claim a purchase it did not make.
   */
  async submit(
    request: SubmitRequest,
    caller: { userId: string; roles: string[] },
    at: Date = new Date(),
  ): Promise<Review> {
    const purchases = await this.store.purchasesFor(caller.userId, request.variantId);
    const decision = decideSubmission(request, caller, purchases);
    if (!decision.allowed) throw new ReviewNotAllowedError(decision.reason);

    // One row per (user, variant, order). A rating without a purchase has no
    // order, and the unique index treats that as its own slot, so a second bare
    // rating for the same variant is the same opinion expressed twice.
    const existing = await this.store.listByUserAndVariant(caller.userId, request.variantId);
    const sameOrder = existing.find((r) => (r.orderId ?? '') === (decision.order?.orderId ?? ''));
    if (sameOrder) {
      throw new ReviewNotAllowedError(
        'you have already rated or reviewed this product for that order',
      );
    }

    const when = at.toISOString();
    return this.store.create({
      id: randomUUID(),
      variantId: request.variantId,
      userId: caller.userId,
      rating: request.rating,
      body: request.body?.trim() || undefined,
      photoUrl: request.photoUrl?.trim() || undefined,
      orderId: decision.order?.orderId,
      orderLineId: decision.order?.orderLineId,
      verifiedPurchase: decision.verifiedPurchase,
      status: 'pending',
      createdAt: when,
      updatedAt: when,
    });
  }

  /** A customer deletes their own row. There is no edit: a correction is a new
   * row, so the published history cannot be rewritten after the fact. */
  async remove(id: string, caller: { userId: string; roles: string[] }): Promise<boolean> {
    const review = await this.store.get(id);
    if (!review) throw new NotFoundException('no such review');
    const isStaff = caller.roles.some((r) => r === 'support' || r === 'ops_manager' || r === 'chief_admin');
    if (review.userId !== caller.userId && !isStaff) {
      throw new ReviewNotAllowedError('you can only delete your own review');
    }
    return this.store.remove(id);
  }

  /** Public: published rows plus the aggregate. Ratings and written reviews are
   * counted separately so 40 ratings and 2 reviews are not shown as 40 reviews. */
  async listPublished(variantId: string): Promise<ReviewList> {
    const reviews = await this.store.listPublished(variantId);
    return {
      reviews,
      aggregate: aggregate(
        reviews.map((r) => ({
          rating: r.rating,
          body: r.body ?? null,
          verifiedPurchase: r.verifiedPurchase,
        })),
      ),
    };
  }

  /** A moderation decision, recorded before it takes effect so a failure cannot
   * publish without a trace. */
  async moderate(
    id: string,
    action: ModerationAction,
    by: string,
    reason?: string,
    at: Date = new Date(),
  ): Promise<Review> {
    const review = await this.store.get(id);
    if (!review) throw new NotFoundException('no such review');

    const decision = decideModeration(action, reason);
    if (!decision.allowed) throw new ReviewNotAllowedError(decision.reason);

    const when = at.toISOString();
    await this.audit.append({ reviewId: id, action, by, reason, at: when });

    const updated: Review = {
      ...review,
      status: decision.status as ReviewStatus,
      rejectedReason: action === 'reject' ? reason : undefined,
      moderatedBy: by,
      moderatedAt: when,
      updatedAt: when,
    };
    return this.store.update(updated);
  }
}
