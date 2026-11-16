import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { PromotionsService } from './promotions.service';
import { Promotion, PromotionCart } from './promotions.types';

@Controller('commerce/promotions')
export class PromotionsController {
  constructor(private readonly service: PromotionsService) {}

  @Get()
  @RequirePermissions('catalog:read')
  list(): Promise<Promotion[]> {
    return this.service.list();
  }

  @Get(':id')
  @RequirePermissions('catalog:read')
  get(@Param('id') id: string): Promise<Promotion> {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions('catalog:write')
  create(@Body() promotion: Promotion): Promise<Promotion> {
    return this.service.create(promotion);
  }

  /** Approve a draft so it can run in its window. */
  @Post(':id/approve')
  @RequirePermissions('catalog:write')
  approve(@Param('id') id: string, @Req() req: unknown): Promise<Promotion> {
    const approver = userFromRequest(req)?.id ?? '';
    return this.service.approve(id, approver);
  }

  @Post(':id/end')
  @RequirePermissions('catalog:write')
  end(@Param('id') id: string): Promise<Promotion> {
    return this.service.end(id);
  }

  /** Price a cart against the live promotions. */
  @Post('evaluate')
  @RequirePermissions('catalog:read')
  evaluate(@Body() cart: PromotionCart) {
    return this.service.evaluate(cart);
  }
}
