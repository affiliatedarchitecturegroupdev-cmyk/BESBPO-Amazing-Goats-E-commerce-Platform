import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { ReportingService } from './reporting.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('ads/reporting')
export class ReportingController {
  constructor(private readonly service: ReportingService) {}

  @Get()
  @RequirePermissions('ads:read')
  list() { return this.service.list(); }
}
