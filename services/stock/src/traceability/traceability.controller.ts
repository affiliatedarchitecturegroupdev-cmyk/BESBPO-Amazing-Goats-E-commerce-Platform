import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { TraceabilityService } from './traceability.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('stock/traceability')
export class TraceabilityController {
  constructor(private readonly service: TraceabilityService) {}

  @Get()
  @RequirePermissions('stock:read')
  list() { return this.service.list(); }
}
