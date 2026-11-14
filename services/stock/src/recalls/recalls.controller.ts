import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { RecallsService } from './recalls.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('stock/recalls')
export class RecallsController {
  constructor(private readonly service: RecallsService) {}

  @Get()
  @RequirePermissions('batches:recall')
  list() { return this.service.list(); }
}
