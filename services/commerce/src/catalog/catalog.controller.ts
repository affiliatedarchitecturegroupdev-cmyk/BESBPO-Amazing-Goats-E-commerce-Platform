import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { currentSession, runWithSession } from '@ag/db';
import { CatalogService } from './catalog.service';
import { CatalogueFilters, CatalogueItem } from './catalog.types';
import { Channel, FulfilmentType, Phase, Temperature } from '@ag/shared-types';

/** Parse the shared catalogue filters from query params. */
export function filtersFromQuery(q: Record<string, unknown>): CatalogueFilters {
  const filters: CatalogueFilters = {};
  if (typeof q.line === 'string' && q.line) filters.line = q.line;
  if (typeof q.category === 'string' && q.category) filters.category = q.category;
  if (typeof q.fulfilment === 'string' && q.fulfilment) filters.fulfilment = q.fulfilment as FulfilmentType;
  if (typeof q.channel === 'string' && q.channel) filters.channel = q.channel as Channel;
  if (typeof q.temperature === 'string' && q.temperature) filters.temperature = q.temperature as Temperature;
  const phase = Number(q.phase);
  if (phase === 1 || phase === 2 || phase === 3) filters.phase = phase as Phase;
  return filters;
}

/**
 * The storefront is browsed before it is joined (T-082), so the catalogue reads
 * are public. They are not unscoped: with no caller the session is anonymous,
 * and the policies from migration 0025 expose only active rows to it. A caller
 * that already has a session (a signed-in customer, or staff) keeps it, so staff
 * still see inactive rows. The anonymous case is set explicitly rather than
 * inherited from the middleware, so the intent is visible at the call site.
 */
function withCatalogueSession<T>(fn: () => T): T {
  const session = currentSession();
  const authenticated = Boolean(session.userId ?? session.orgId ?? session.staff);
  return authenticated ? fn() : runWithSession({ staff: false }, fn);
}

@Controller('commerce/catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  @Get()
  list(@Query() q: Record<string, unknown>): Promise<CatalogueItem[]> {
    return withCatalogueSession(() => this.service.list(filtersFromQuery(q)));
  }

  @Get('search')
  search(@Query() q: Record<string, unknown>) {
    const query = typeof q.q === 'string' ? q.q : '';
    return withCatalogueSession(() =>
      this.service.search(query, filtersFromQuery(q), {
        limit: Number(q.limit) || undefined,
        minScore: Number(q.minScore) || undefined,
      }),
    );
  }

  @Get(':sku')
  get(@Param('sku') sku: string): Promise<CatalogueItem> {
    return withCatalogueSession(() => this.service.get(sku));
  }

  @Post()
  @RequirePermissions('catalog:write')
  upsert(@Body() item: CatalogueItem): Promise<CatalogueItem> {
    if (!item?.sku) throw new NotFoundException('sku is required');
    return this.service.upsert(item);
  }

  @Delete(':sku')
  @RequirePermissions('catalog:write')
  async remove(@Param('sku') sku: string): Promise<{ removed: string }> {
    await this.service.remove(sku);
    return { removed: sku };
  }
}
