import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { TemperatureService } from './temperature.service';
import { TemperatureLog, TemperatureLogInput } from './temperature.types';

@Controller('stock/temperature')
export class TemperatureController {
  constructor(private readonly service: TemperatureService) {}

  @Get()
  @RequirePermissions('stock:read')
  list(
    @Query('subjectType') subjectType?: string,
    @Query('subjectId') subjectId?: string,
  ): Promise<TemperatureLog[]> {
    return this.service.list({ subjectType, subjectId });
  }

  /** Record one or more readings; breaches raise an alert. */
  @Post()
  @RequirePermissions('stock:write')
  record(
    @Body() body: { readings: TemperatureLogInput[] },
  ): Promise<{ incidents: number; alertsRaised: number }> {
    return this.service.record(body.readings ?? []);
  }

  /** Re-check everything stored; used by the scheduled cold-chain check. */
  @Post('evaluate')
  @RequirePermissions('stock:write')
  evaluate(): Promise<{ incidents: number; alertsRaised: number }> {
    return this.service.evaluateAll();
  }

  @Get(':id')
  @RequirePermissions('stock:read')
  bySubject(@Param('id') subjectId: string): Promise<TemperatureLog[]> {
    return this.service.list({ subjectId });
  }
}
