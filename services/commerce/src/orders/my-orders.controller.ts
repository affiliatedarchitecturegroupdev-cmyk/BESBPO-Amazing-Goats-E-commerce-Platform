import { Controller, Get, Param, Req } from '@nestjs/common';
import { RequireAuthenticated, userFromRequest } from '@ag/nest-auth';
import { canAny } from '@ag/rbac';
import type { Role } from '@ag/rbac';
import { OrdersService } from './orders.service';
import type { Caller, PublicOrder } from './order-access';

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
 * The shopper's own orders (T-077 `sf-track`).
 *
 * Separate from `OrdersController` because the audience and the rule are
 * different: that controller is the staff listing behind `orders:read`, and this
 * one is a customer reading their own rows behind `@RequireAuthenticated`. A
 * customer does not hold `orders:read` and must not gain it to track a parcel.
 *
 * Both routes come before any `:id` route in the service, because Express
 * matches in declaration order and `/commerce/my-orders` would otherwise be read
 * as an order whose id is "my-orders".
 */
@Controller('commerce/my-orders')
export class MyOrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  @RequireAuthenticated()
  list(@Req() req: unknown): Promise<PublicOrder[]> {
    return this.service.myOrders(callerFrom(req));
  }

  @Get(':id')
  @RequireAuthenticated()
  get(@Param('id') id: string, @Req() req: unknown): Promise<PublicOrder> {
    return this.service.myOrder(id, callerFrom(req));
  }
}
