import type { Db } from '@ag/db';
import { currentSession, toIso, toIsoOrUndefined } from '@ag/db';
import type { ReviewStatus } from './reviews.rules';
import { OrderLineFact, Review, ReviewStore } from './reviews.store';

interface ReviewRow {
  id: string;
  sku: string;
  user_id: string;
  rating: number;
  body: string | null;
  photo_url: string | null;
  order_external_id: string | null;
  order_line_id: string | null;
  verified_purchase: boolean;
  status: ReviewStatus;
  rejected_reason: string | null;
  moderated_by: string | null;
  moderated_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface PurchaseRow {
  sku: string;
  order_external_id: string;
  order_line_id: string;
  status: string;
}

/**
 * The domain speaks in SKUs (`catalog.variants.sku`), while `sales.reviews`
 * keys on the variant uuid, so every read joins the variant to recover the SKU.
 * A row whose variant has since been deleted is dropped rather than surfaced
 * with a dangling id.
 */
const SELECT_REVIEWS = `
  SELECT r.id, v.sku, r.user_id, r.rating, r.body, r.photo_url, o.external_id AS order_external_id,
         r.order_line_id, r.verified_purchase, r.status, r.rejected_reason, r.moderated_by,
         r.moderated_at, r.created_at, r.updated_at
    FROM sales.reviews r
    JOIN catalog.variants v ON v.id = r.variant_id
    LEFT JOIN sales.orders o ON o.id = r.order_id`;

function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    variantId: row.sku,
    userId: row.user_id,
    rating: row.rating,
    body: row.body ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    orderId: row.order_external_id ?? undefined,
    orderLineId: row.order_line_id ?? undefined,
    verifiedPurchase: row.verified_purchase,
    status: row.status,
    rejectedReason: row.rejected_reason ?? undefined,
    moderatedBy: row.moderated_by ?? undefined,
    moderatedAt: toIsoOrUndefined(row.moderated_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/**
 * SQL adapter over `sales.reviews` and `sales.order_lines` (migration 0022).
 *
 * The row id is the domain id: the service mints a uuid, so no `external_id`
 * mapping is needed. Owner columns come from the caller's own object, and the
 * table's RLS policies are what stop a caller writing or reading another
 * person's rows — the store adds no filter of its own, except on
 * `purchasesFor`, which must scope to the caller explicitly because a staff
 * session would otherwise read every order line.
 */
export class PgReviewStore implements ReviewStore {
  constructor(private readonly db: Db) {}

  async create(review: Review): Promise<Review> {
    try {
      await this.db.withSession(currentSession(), (tx) =>
        tx.query(
          `INSERT INTO sales.reviews
             (id, variant_id, user_id, rating, body, photo_url, order_id, order_line_id,
              verified_purchase, status, created_at, updated_at)
           SELECT $1, v.id, $2, $3, $4, $5, o.id, $7, $8, $9, $10, $11
             FROM catalog.variants v
             LEFT JOIN sales.orders o ON o.external_id = $6
            WHERE v.sku = $12`,
          [
            review.id,
            review.userId,
            review.rating,
            review.body ?? null,
            review.photoUrl ?? null,
            review.orderId ?? null,
            review.orderLineId ?? null,
            review.verifiedPurchase,
            review.status,
            review.createdAt,
            review.updatedAt,
            review.variantId,
          ],
        ),
      );
    } catch (error) {
      // The unique index on (user_id, variant_id, order_id) is the real guard
      // against a buyer multiplying one purchase into several reviews; the
      // service checks first, so this only fires on a concurrent submission.
      if ((error as { code?: string }).code === '23505') {
        throw new Error('duplicate review for this order');
      }
      throw error;
    }
    return review;
  }

  async get(id: string): Promise<Review | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ReviewRow>(`${SELECT_REVIEWS} WHERE r.id = $1`, [id]),
    );
    return rows[0] ? toReview(rows[0]) : undefined;
  }

  async listPublished(variantId: string): Promise<Review[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ReviewRow>(
        `${SELECT_REVIEWS} WHERE v.sku = $1 AND r.status = 'published' ORDER BY r.created_at DESC`,
        [variantId],
      ),
    );
    return rows.map(toReview);
  }

  async listByUserAndVariant(userId: string, variantId: string): Promise<Review[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ReviewRow>(`${SELECT_REVIEWS} WHERE r.user_id = $1 AND v.sku = $2`, [
        userId,
        variantId,
      ]),
    );
    return rows.map(toReview);
  }

  /**
   * The caller's own order lines for a variant, whatever the order status — the
   * purchase rule decides which of them count. Scoped to `customer_user_id` as
   * well as RLS so a staff session cannot answer for the customer.
   */
  async purchasesFor(userId: string, variantId: string): Promise<OrderLineFact[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<PurchaseRow>(
        `SELECT v.sku, o.external_id AS order_external_id, ol.id AS order_line_id, o.status
           FROM sales.order_lines ol
           JOIN sales.orders o ON o.id = ol.order_id
           JOIN catalog.variants v ON v.id = ol.variant_id
          WHERE o.customer_user_id = $1 AND v.sku = $2
          ORDER BY o.created_at DESC`,
        [userId, variantId],
      ),
    );
    return rows.map((row) => ({
      variantId: row.sku,
      orderId: row.order_external_id,
      orderLineId: row.order_line_id,
      orderStatus: row.status,
    }));
  }

  async update(review: Review): Promise<Review> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(
        `UPDATE sales.reviews
            SET rating = $2, body = $3, photo_url = $4, status = $5, rejected_reason = $6,
                moderated_by = $7, moderated_at = $8, updated_at = $9
          WHERE id = $1`,
        [
          review.id,
          review.rating,
          review.body ?? null,
          review.photoUrl ?? null,
          review.status,
          review.rejectedReason ?? null,
          review.moderatedBy ?? null,
          review.moderatedAt ?? null,
          review.updatedAt,
        ],
      ),
    );
    return review;
  }

  async remove(id: string): Promise<boolean> {
    const { rowCount } = await this.db.withSession(currentSession(), (tx) =>
      tx.query(`DELETE FROM sales.reviews WHERE id = $1`, [id]),
    );
    return (rowCount ?? 0) > 0;
  }
}
