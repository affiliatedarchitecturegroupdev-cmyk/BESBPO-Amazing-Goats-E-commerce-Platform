import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { SlotsService } from './slots.service';
import { BookingResult, Slot } from './slots.types';

@Controller('logistics/slots')
export class SlotsController {
  constructor(private readonly service: SlotsService) {}

  @Get()
  @RequirePermissions('routes:read')
  list(): Promise<Slot[]> {
    return this.service.list();
  }

  @Get('available')
  @RequirePermissions('routes:read')
  available(@Query('earlyOnly') earlyOnly?: string): Promise<Slot[]> {
    return this.service.available(new Date(), { earlyOnly: earlyOnly === 'true' });
  }

  @Get(':id')
  @RequirePermissions('routes:read')
  get(@Param('id') id: string): Promise<Slot> {
    return this.service.get(id);
  }

  @Post(':id/book')
  @RequirePermissions('delivery:execute')
  book(@Param('id') id: string): Promise<BookingResult> {
    return this.service.book(id);
  }
}
