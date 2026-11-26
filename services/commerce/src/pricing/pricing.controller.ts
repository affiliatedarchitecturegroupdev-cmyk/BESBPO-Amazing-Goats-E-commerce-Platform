import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req } from '@nestjs/common';
import { RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { canAny } from '@ag/rbac';
import { PricingService } from './pricing.service';
import { PriceList, PriceListAudience, PRICE_LIST_AUDIENCES, ResolvedPrice } from './pricing.types';

function audienceFrom(q: Record<string, unknown>): PriceListAudience {
  const value = typeof q.audience === 'string' ? q.audience : 'public';
  return (PRICE_LIST_AUDIENCES as readonly string[]).includes(value)
    ? (value as PriceListAudience)
    : 'public';
}

/**
 * The storefront reads prices without an account (T-082), so the price routes
 * are public — but only for the `public` audience. Trade audiences are a
 * different commercial offer, and a caller must hold `pricing:read` to name one.
 * A request for another audience is refused rather than quietly served the
 * public list: a silent downgrade would show a trade buyer the retail price and
 * look like a bug in the pricing engine.
 */
function assertAudienceAllowed(q: Record<string, unknown>, req: unknown): PriceListAudience {
  const audience = audienceFrom(q);
  if (audience === 'public') return audience;
  const roles = userFromRequest(req)?.roles ?? [];
  if (!canAny(roles, 'pricing:read')) {
    throw new ForbiddenException(`audience "${audience}" requires pricing:read`);
  }
  return audience;
}

/** Cap a bulk price read; a catalogue page needs tens of SKUs, not thousands. */
export const MAX_PRICE_SKUS = 100;

/**
 * Parse a comma-separated `skus` param. Empty entries are dropped, duplicates
 * removed, and the list is capped so one anonymous request cannot ask the
 * pricing engine for the whole catalogue.
 */
export function skusFrom(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const sku = part.trim();
    if (sku) seen.add(sku);
    if (seen.size >= MAX_PRICE_SKUS) break;
  }
  return [...seen];
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
  active(@Query() q: Record<string, unknown>, @Req() req: unknown): Promise<PriceList | null> {
    return this.service.activeFor(assertAudienceAllowed(q, req));
  }

  @Get('price')
  price(@Query() q: Record<string, unknown>, @Req() req: unknown) {
    const sku = typeof q.sku === 'string' ? q.sku : '';
    return this.service.priceFor(assertAudienceAllowed(q, req), sku);
  }

  /**
   * Prices for many SKUs from one list version, so a catalogue page is a single
   * read rather than one call per product. Same audience rule as the single
   * read: public by default, anything else needs `pricing:read`.
   */
  @Get('prices')
  prices(@Query() q: Record<string, unknown>, @Req() req: unknown): Promise<Record<string, ResolvedPrice>> {
    return this.service.priceMany(assertAudienceAllowed(q, req), skusFrom(q.skus));
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
