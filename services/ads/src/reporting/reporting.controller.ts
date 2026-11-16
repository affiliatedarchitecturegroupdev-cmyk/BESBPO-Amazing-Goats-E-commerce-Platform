import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { AdReport, ReportingService } from './reporting.service';

/** Retail-media reporting: impressions, clicks and click-through per creative. */
@Controller('ads/reporting')
export class ReportingController {
  constructor(private readonly service: ReportingService) {}

  @Get()
  @RequirePermissions('ads:read')
  report(): Promise<AdReport> {
    return this.service.report();
  }
}
