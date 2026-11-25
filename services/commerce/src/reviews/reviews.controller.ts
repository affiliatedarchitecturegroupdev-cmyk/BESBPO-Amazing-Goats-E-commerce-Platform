import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import { RequireAuthenticated, RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { ReviewsService } from './reviews.service';
import type { ReviewList } from './reviews.service';
import type { ModerationAction, SubmitRequest } from './reviews.rules';
import type { Review } from './reviews.store';

interface Caller {
  userId: string;
  roles: string[];
}

/** The guard has already rejected an anonymous caller on every route below, so
 * the user is present; the empty fallback only satisfies the type. */
function callerFrom(req: unknown): Caller {
  const user = userFromRequest(req);
  return { userId: user?.id ?? '', roles: (user?.roles as string[]) ?? [] };
}

@Controller('commerce/reviews')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  /**
   * Public read: published rows and the aggregate. Ratings and written reviews
   * are reported separately, so a product with many scores and few written
   * reviews does not look like it has many reviews.
   */
  @Get()
  list(@Query('variantId') variantId: string): Promise<ReviewList> {
    return this.service.listPublished(variantId ?? '');
  }

  /** A rating or a review. `RequireAuthenticated` rather than a permission: the
   * role check is the domain rule (customer or trade may rate; only a buyer may
   * write), and it lives in `decideSubmission`, not in the RBAC matrix. */
  @Post()
  @RequireAuthenticated()
  submit(@Body() body: SubmitRequest, @Req() req: unknown): Promise<Review> {
    return this.service.submit(
      {
        variantId: body.variantId,
        rating: Number(body.rating),
        body: body.body,
        photoUrl: body.photoUrl,
      },
      callerFrom(req),
    );
  }

  /** A customer deletes their own row; staff may delete any. */
  @Delete(':id')
  @RequireAuthenticated()
  remove(@Param('id') id: string, @Req() req: unknown): Promise<boolean> {
    return this.service.remove(id, callerFrom(req));
  }

  /** Publish or reject with a reason. Moderation is the act that turns text into
   * published advertising, so it is a named permission and every decision is
   * audited. */
  @Post(':id/moderate')
  @RequirePermissions('reviews:moderate')
  moderate(
    @Param('id') id: string,
    @Body() body: { action: ModerationAction; reason?: string },
    @Req() req: unknown,
  ): Promise<Review> {
    return this.service.moderate(id, body.action, callerFrom(req).userId, body.reason);
  }
}
