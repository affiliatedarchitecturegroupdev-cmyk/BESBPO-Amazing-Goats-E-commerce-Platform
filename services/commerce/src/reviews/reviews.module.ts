import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { ReviewsController } from './reviews.controller';
import {
  InMemoryReviewAudit,
  ReviewsService,
  REVIEW_AUDIT,
  REVIEW_STORE,
  type ReviewAuditStore,
} from './reviews.service';
import { InMemoryReviewStore, ReviewStore } from './reviews.store';
import { PgReviewStore } from './reviews.sql-store';
import { PgReviewAudit } from './reviews.sql-audit';

/**
 * Ratings and reviews. Both the rows (`sales.reviews`, migration 0022) and the
 * moderation trail (`audit.audit_log`) follow the service-wide store driver, so
 * `STORE_DRIVER=sql` persists a decision as well as the review it concerns.
 */
@Module({
  controllers: [ReviewsController],
  providers: [
    ReviewsService,
    {
      provide: REVIEW_STORE,
      useFactory: (db?: Db) =>
        selectStore<ReviewStore>(new InMemoryReviewStore(), () => new PgReviewStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
    {
      provide: REVIEW_AUDIT,
      useFactory: (db?: Db) =>
        selectStore<ReviewAuditStore>(new InMemoryReviewAudit(), () => new PgReviewAudit(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [ReviewsService],
})
export class ReviewsModule {}
