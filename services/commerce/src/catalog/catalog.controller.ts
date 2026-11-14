import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
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

@Controller('commerce/catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  @Get()
  @RequirePermissions('catalog:read')
  list(@Query() q: Record<string, unknown>): Promise<CatalogueItem[]> {
    return this.service.list(filtersFromQuery(q));
  }

  @Get('search')
  @RequirePermissions('catalog:read')
  search(@Query() q: Record<string, unknown>) {
    const query = typeof q.q === 'string' ? q.q : '';
    return this.service.search(query, filtersFromQuery(q), {
      limit: Number(q.limit) || undefined,
      minScore: Number(q.minScore) || undefined,
    });
  }

  @Get(':sku')
  @RequirePermissions('catalog:read')
  get(@Param('sku') sku: string): Promise<CatalogueItem> {
    return this.service.get(sku);
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
