import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import { RequireAuthenticated, userFromRequest } from '@ag/nest-auth';
import { canAny } from '@ag/rbac';
import type { Role } from '@ag/rbac';
import type { Caller } from '../orders/order-access';
import { SubscriptionsService } from './subscriptions.service';
import type { PublicSubscription } from './subscription-access';

/** The caller as the guard resolved them, with the staff test made explicit. */
function callerFrom(req: unknown): Caller {
  const user = userFromRequest(req);
  const roles = (user?.roles ?? []) as Role[];
  return {
    ...(user?.id ? { userId: user.id } : {}),
    staff: canAny(roles, 'orders:read'),
  };
}

/**
 * The shopper's own subscriptions (`/account`, T-056).
 *
 * Separate from `SubscriptionsController` for the same reason `MyOrdersController`
 * is separate from `OrdersController`: that controller is the staff view behind
 * `orders:read`, and this one is a customer reading their own rows behind
 * `@RequireAuthenticated`. A customer holds only `customer:own` and must not gain
 * `orders:read` to see their own schedule.
 *
 * The path is `my-subscriptions` rather than a sub-path of `commerce/subscriptions`
 * because that controller owns `:id`; a distinct path means the two cannot shadow
 * each other whatever order Nest registers them in.
 */
@Controller('commerce/my-subscriptions')
export class MySubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  @Get()
  @RequireAuthenticated()
  list(@Req() req: unknown): Promise<PublicSubscription[]> {
    return this.service.mySubscriptions(callerFrom(req));
  }

  @Get(':id')
  @RequireAuthenticated()
  get(@Param('id') id: string, @Req() req: unknown): Promise<PublicSubscription> {
    return this.service.mySubscription(id, callerFrom(req));
  }

  @Post(':id/pause')
  @RequireAuthenticated()
  pause(@Param('id') id: string, @Req() req: unknown): Promise<PublicSubscription> {
    return this.service.setPausedByOwner(id, true, callerFrom(req));
  }

  @Post(':id/resume')
  @RequireAuthenticated()
  resume(@Param('id') id: string, @Req() req: unknown): Promise<PublicSubscription> {
    return this.service.setPausedByOwner(id, false, callerFrom(req));
  }
}
