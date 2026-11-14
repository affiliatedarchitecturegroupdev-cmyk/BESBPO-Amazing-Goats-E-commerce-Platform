import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { OrdersService } from './orders.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('commerce/orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  @RequirePermissions('orders:read')
  list() { return this.service.list(); }
}
