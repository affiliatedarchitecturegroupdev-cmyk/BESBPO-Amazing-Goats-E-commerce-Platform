import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { ZonesService } from './zones.service';
import { DeliveryQuote, GeoPoint, Zone } from './zones.types';

interface QuoteBody extends GeoPoint {
  goodsTotalCents?: number;
}

@Controller('logistics/zones')
export class ZonesController {
  constructor(private readonly service: ZonesService) {}

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
