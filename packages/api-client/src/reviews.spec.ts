import { describe, it, expect } from 'vitest';
import { moderateReviewPath, reviewsPath } from './reviews';

describe('review paths', () => {
  it('builds the public list path for a variant', () => {
    expect(reviewsPath('v 1')).toBe('/commerce/reviews?variantId=v%201');
  });

  it('builds the moderation path', () => {
    expect(moderateReviewPath('r1')).toBe('/commerce/reviews/r1/moderate');
  });
});
