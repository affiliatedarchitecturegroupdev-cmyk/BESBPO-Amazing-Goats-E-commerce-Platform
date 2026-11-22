import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService, REVIEW_AUDIT, REVIEW_STORE } from './reviews.service';
import { InMemoryReviewStore } from './reviews.store';
import { InMemoryReviewAudit } from './reviews.service';

/**
 * Ratings and reviews. The stores are in-memory behind the interfaces a SQL
 * adapter implements (`sales.reviews`, `sales.order_lines`); the tables and the
 * policies exist (migration 0022), so selecting the SQL adapter is the remaining
 * step, as it is for the other commerce modules.
 */
@Module({
  controllers: [ReviewsController],
  providers: [
    ReviewsService,
    { provide: REVIEW_STORE, useFactory: () => new InMemoryReviewStore() },
    { provide: REVIEW_AUDIT, useFactory: () => new InMemoryReviewAudit() },
  ],
  exports: [ReviewsService],
})
export class ReviewsModule {}
