import { Controller, Get, Param } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { TraceabilityService } from './traceability.service';
import { BatchTrace } from './traceability.domain';

@Controller('stock/traceability')
export class TraceabilityController {
  constructor(private readonly service: TraceabilityService) {}

  @Get(':batchId')
  @RequirePermissions('stock:read')
  trace(@Param('batchId') batchId: string): Promise<BatchTrace> {
    return this.service.trace(batchId);
  }
}
