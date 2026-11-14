import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { OrdersService } from './orders.service';
import { Cart, Order } from './orders.types';

@Controller('commerce/orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  @RequirePermissions('orders:read')
  list(): Promise<Order[]> {
    return this.service.list();
  }

  @Get(':id')
  @RequirePermissions('orders:read')
  get(@Param('id') id: string): Promise<Order> {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions('orders:write')
  create(@Body() cart: Cart): Promise<Order> {
    return this.service.create(cart);
  }
}
