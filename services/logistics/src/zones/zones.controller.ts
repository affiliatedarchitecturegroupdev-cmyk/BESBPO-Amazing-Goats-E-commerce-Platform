import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { ZonesService } from './zones.service';
import { DeliveryQuote, GeoPoint, Zone } from './zones.types';
import type { ZoneCheck } from './zone-check.rules';

interface QuoteBody extends GeoPoint {
  goodsTotalCents?: number;
}

@Controller('logistics/zones')
export class ZonesController {
  // Explicit token, like the gateway's controllers: esbuild-based test runs emit
  // no decorator metadata, so an implicit type-only injection resolves undefined.
  constructor(@Inject(ZonesService) private readonly service: ZonesService) {}

  /**
   * Public by design: a shopper checks delivery before signing in, and the
   * answer reveals only the zone they named, never the zone table. Declared
   * before `:id` so `check` is not parsed as a zone id.
   */
  @Get('check')
  check(
    @Query('postalCode') postalCode?: string,
    @Query('suburb') suburb?: string,
    @Query('goodsTotalCents') goodsTotalCents?: string,
  ): Promise<ZoneCheck> {
    const cents = goodsTotalCents === undefined ? undefined : Number(goodsTotalCents);
    return this.service.check(
      { postalCode, suburb },
      cents === undefined || Number.isNaN(cents) ? {} : { goodsTotalCents: cents },
    );
  }

  @Get()
  @RequirePermissions('routes:read')
  list(): Promise<Zone[]> {
    return this.service.list();
  }

  @Post('quote')
  @RequirePermissions('routes:read')
  quote(@Body() body: QuoteBody): Promise<DeliveryQuote> {
    return this.service.quote({ lat: body.lat, lng: body.lng }, body.goodsTotalCents);
  }

  @Get(':id')
  @RequirePermissions('routes:read')
  get(@Param('id') id: string): Promise<Zone> {
    return this.service.get(Number(id));
  }
}
