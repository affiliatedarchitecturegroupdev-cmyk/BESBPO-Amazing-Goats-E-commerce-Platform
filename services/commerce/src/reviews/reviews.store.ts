import type { ReviewStatus } from './reviews.rules';

export interface Review {
  id: string;
  variantId: string;
  userId: string;
  rating: number;
  body?: string;
  photoUrl?: string;
  orderId?: string;
  orderLineId?: string;
  verifiedPurchase: boolean;
  status: ReviewStatus;
  rejectedReason?: string;
  moderatedBy?: string;
  moderatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** The caller's order lines for a variant, which is what the purchase rule
 * reads. Supplied by the store from `sales.order_lines` joined to `sales.orders`. */
export interface OrderLineFact {
  variantId: string;
  orderId: string;
  orderLineId: string;
  orderStatus: string;
}

export interface ReviewStore {
  create(review: Review): Promise<Review>;
  get(id: string): Promise<Review | undefined>;
  /** Published rows for a variant, newest first — what the public sees. */
  listPublished(variantId: string): Promise<Review[]>;
  /** Every row by this user for this variant, whatever its status. */
  listByUserAndVariant(userId: string, variantId: string): Promise<Review[]>;
  /** The caller's order lines for a variant, for the purchase rule. */
  purchasesFor(userId: string, variantId: string): Promise<OrderLineFact[]>;
  update(review: Review): Promise<Review>;
  remove(id: string): Promise<boolean>;
}

/**
 * In-memory store. The SQL adapter (`reviews.sql-store.ts`) reads the same
 * shapes from `sales.reviews` and `sales.order_lines`; this one exists so the
 * rules and the service are testable without a database.
 */
export class InMemoryReviewStore implements ReviewStore {
  private readonly rows = new Map<string, Review>();
  private readonly purchases: { userId: string; fact: OrderLineFact }[] = [];

  /** Seeds a purchase fact, as the SQL adapter would read from order_lines. */
  addPurchase(userId: string, fact: OrderLineFact): void {
    this.purchases.push({ userId, fact });
  }

  async create(review: Review): Promise<Review> {
    const clash = [...this.rows.values()].some(
      (r) =>
        r.userId === review.userId &&
        r.variantId === review.variantId &&
        (r.orderId ?? '') === (review.orderId ?? ''),
    );
    if (clash) throw new Error('duplicate review for this order');
    this.rows.set(review.id, review);
    return review;
  }

  async get(id: string): Promise<Review | undefined> {
    return this.rows.get(id);
  }

  async listPublished(variantId: string): Promise<Review[]> {
    return [...this.rows.values()]
      .filter((r) => r.variantId === variantId && r.status === 'published')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listByUserAndVariant(userId: string, variantId: string): Promise<Review[]> {
    return [...this.rows.values()].filter((r) => r.userId === userId && r.variantId === variantId);
  }

  async purchasesFor(userId: string, variantId: string): Promise<OrderLineFact[]> {
    return this.purchases
      .filter((p) => p.userId === userId && p.fact.variantId === variantId)
      .map((p) => p.fact);
  }

  async update(review: Review): Promise<Review> {
    this.rows.set(review.id, review);
    return review;
  }

  async remove(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }
}
