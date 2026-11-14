import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { BatchesService } from './batches.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('stock/batches')
export class BatchesController {
  constructor(private readonly service: BatchesService) {}

  @Get()
  @RequirePermissions('stock:read')
  list() { return this.service.list(); }
}
