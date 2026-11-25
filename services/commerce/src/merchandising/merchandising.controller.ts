import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { MerchandisingService } from './merchandising.service';
import { MerchItem, MerchPage, MerchSection, MERCH_PAGES } from './merchandising.types';

function pageFrom(q: Record<string, unknown>): MerchPage {
  const value = typeof q.page === 'string' ? q.page : 'home';
  return (MERCH_PAGES as readonly string[]).includes(value) ? (value as MerchPage) : 'home';
}

@Controller('commerce/merchandising')
export class MerchandisingController {
  constructor(private readonly service: MerchandisingService) {}

  @Get()
  @RequirePermissions('merch:manage')
  list(): Promise<MerchSection[]> {
    return this.service.list();
  }

  /**
   * The resolved sections for a page — the read the storefront BFF uses. It is
   * public on purpose: a curated section is marketing content the shop shows to
   * everyone, and no storefront caller holds `merch:manage`. The rule and the
   * `merch_sections_select` policy (migration 0018) both hide an inactive or
   * out-of-window section, so an anonymous read only ever sees live strips.
   * Declared before `:id` so `page` is not read as a section id.
   */
  @Get('page')
  forPage(@Query() q: Record<string, unknown>) {
    return this.service.forPage(pageFrom(q));
  }

  @Get(':id')
  @RequirePermissions('merch:manage')
  get(@Param('id') id: string): Promise<MerchSection> {
    return this.service.get(id);
  }

  @Get(':id/resolved')
  @RequirePermissions('merch:manage')
  resolved(@Param('id') id: string) {
    return this.service.resolve(id);
  }

  @Post()
  @RequirePermissions('merch:manage')
  upsert(@Body() section: MerchSection): Promise<MerchSection> {
    return this.service.upsert(section);
  }

  @Put(':id/items')
  @RequirePermissions('merch:manage')
  setItems(@Param('id') id: string, @Body() items: MerchItem[]): Promise<MerchItem[]> {
    return this.service.setItems(id, items);
  }
}
