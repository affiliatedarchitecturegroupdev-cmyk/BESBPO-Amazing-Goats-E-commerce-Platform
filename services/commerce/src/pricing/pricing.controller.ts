import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { PricingService } from './pricing.service';
import { PriceList, PriceListAudience, PRICE_LIST_AUDIENCES } from './pricing.types';

function audienceFrom(q: Record<string, unknown>): PriceListAudience {
  const value = typeof q.audience === 'string' ? q.audience : 'public';
  return (PRICE_LIST_AUDIENCES as readonly string[]).includes(value)
    ? (value as PriceListAudience)
    : 'public';
}

@Controller('commerce/pricing')
export class PricingController {
  constructor(private readonly service: PricingService) {}

  @Get()
  @RequirePermissions('pricing:read')
  list(): Promise<PriceList[]> {
    return this.service.list();
  }

  @Get('active')
  @RequirePermissions('pricing:read')
  active(@Query() q: Record<string, unknown>): Promise<PriceList | null> {
    return this.service.activeFor(audienceFrom(q));
  }

  @Get('price')
  @RequirePermissions('pricing:read')
  price(@Query() q: Record<string, unknown>) {
    const sku = typeof q.sku === 'string' ? q.sku : '';
    return this.service.priceFor(audienceFrom(q), sku);
  }

  @Get(':id')
  @RequirePermissions('pricing:read')
  get(@Param('id') id: string): Promise<PriceList> {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions('pricing:write')
  create(@Body() list: PriceList): Promise<PriceList> {
    return this.service.create(list);
  }

  /** Ask a second person to approve the price change. */
  @Post(':id/submit')
  @RequirePermissions('pricing:write')
  submit(@Param('id') id: string, @Req() req: unknown): Promise<PriceList> {
    const requester = userFromRequest(req)?.id ?? '';
    return this.service.submit(id, requester);
  }

  /** Publish; needs `pricing:approve`, and the approver must not be the requester. */
  @Post(':id/approve')
  @RequirePermissions('pricing:approve')
  approve(@Param('id') id: string, @Req() req: unknown): Promise<PriceList> {
    const approver = userFromRequest(req)?.id ?? '';
    return this.service.approve(id, approver);
  }
}
