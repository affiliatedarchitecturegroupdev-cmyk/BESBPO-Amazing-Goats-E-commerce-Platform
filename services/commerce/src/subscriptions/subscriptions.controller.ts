import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { SubscriptionsService } from './subscriptions.service';
import { StandingOrder, Subscription } from './subscriptions.types';

/** Parse an optional `at` query param into a Date, defaulting to now. */
function atFrom(q: Record<string, unknown>): Date {
  const value = typeof q.at === 'string' ? Date.parse(q.at) : NaN;
  return Number.isNaN(value) ? new Date() : new Date(value);
}

@Controller('commerce/subscriptions')
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  @Get()
  @RequirePermissions('orders:read')
  list(): Promise<Subscription[]> {
    return this.service.list();
  }

  @Get('due')
  @RequirePermissions('orders:read')
  due(@Query() q: Record<string, unknown>) {
    return this.service.due(atFrom(q));
  }

  @Get('standing-orders')
  @RequirePermissions('orders:read')
  listStandingOrders(): Promise<StandingOrder[]> {
    return this.service.listStandingOrders();
  }

  @Get('standing-orders/due')
  @RequirePermissions('orders:read')
  dueStanding(@Query() q: Record<string, unknown>) {
    return this.service.dueStanding(atFrom(q));
  }

  @Get(':id')
  @RequirePermissions('orders:read')
  get(@Param('id') id: string): Promise<Subscription> {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions('orders:write')
  create(@Body() subscription: Subscription): Promise<Subscription> {
    return this.service.create(subscription);
  }

  @Post(':id/run')
  @RequirePermissions('orders:write')
  run(@Param('id') id: string) {
    return this.service.run(id);
  }

  @Post(':id/skip')
  @RequirePermissions('orders:write')
  skip(@Param('id') id: string): Promise<Subscription> {
    return this.service.skip(id);
  }

  @Post(':id/pause')
  @RequirePermissions('orders:write')
  pause(@Param('id') id: string): Promise<Subscription> {
    return this.service.pause(id);
  }

  @Post(':id/resume')
  @RequirePermissions('orders:write')
  resume(@Param('id') id: string): Promise<Subscription> {
    return this.service.resume(id);
  }

  @Post('standing-orders')
  @RequirePermissions('orders:write')
  createStandingOrder(@Body() standing: StandingOrder): Promise<StandingOrder> {
    return this.service.createStandingOrder(standing);
  }

  @Post('standing-orders/:id/activate')
  @RequirePermissions('orders:write')
  activateStandingOrder(@Param('id') id: string): Promise<StandingOrder> {
    return this.service.setStandingOrderActive(id, true);
  }

  @Post('standing-orders/:id/deactivate')
  @RequirePermissions('orders:write')
  deactivateStandingOrder(@Param('id') id: string): Promise<StandingOrder> {
    return this.service.setStandingOrderActive(id, false);
  }
}
