import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { ReconciliationService } from './reconciliation.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('payments/reconciliation')
export class ReconciliationController {
  constructor(private readonly service: ReconciliationService) {}

  @Get()
  @RequirePermissions('payments:reconcile')
  list() { return this.service.list(); }
}
