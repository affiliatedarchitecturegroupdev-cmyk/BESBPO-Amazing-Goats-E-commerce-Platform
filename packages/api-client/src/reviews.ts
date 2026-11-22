/**
 * Review and rating types shared by the storefront and the staff portals.
 *
 * `ratingCount` and `reviewCount` are separate on purpose: 40 scores and 2
 * written reviews must never be shown as "40 reviews", which is the misleading
 * shape a single count produces.
 */

export type ReviewStatus = 'pending' | 'published' | 'rejected';

export interface ReviewView {
  id: string;
  variantId: string;
  userId: string;
  rating: number;
  body?: string;
  photoUrl?: string;
  verifiedPurchase: boolean;
  status: ReviewStatus;
  rejectedReason?: string;
  createdAt: string;
}

export interface ReviewAggregateView {
  ratingCount: number;
  reviewCount: number;
  averageRating: number | null;
  verifiedCount: number;
}

export interface ReviewListView {
  reviews: ReviewView[];
  aggregate: ReviewAggregateView;
}

export interface ReviewSubmitInput {
  variantId: string;
  rating: number;
  body?: string;
  photoUrl?: string;
}

export type ReviewModerationAction = 'publish' | 'reject';

export interface ReviewModerationInput {
  action: ReviewModerationAction;
  reason?: string;
}

export function reviewsPath(variantId: string): string {
  return `/commerce/reviews?variantId=${encodeURIComponent(variantId)}`;
}

export function moderateReviewPath(reviewId: string): string {
  return `/commerce/reviews/${encodeURIComponent(reviewId)}/moderate`;
}
