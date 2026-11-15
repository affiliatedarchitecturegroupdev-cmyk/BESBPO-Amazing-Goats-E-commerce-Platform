import { Controller, Get, Param, Post } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { ReconciliationService } from './reconciliation.service';
import { Settlement } from './reconciliation.types';

@Controller('payments/reconciliation')
export class ReconciliationController {
  constructor(private readonly service: ReconciliationService) {}

  @Get()
  @RequirePermissions('payments:reconcile')
  list(): Promise<Settlement[]> {
    return this.service.list();
  }

  /** The settlements that did not reconcile, for an operator to chase. */
  @Get('exceptions')
  @RequirePermissions('payments:reconcile')
  exceptions() {
    return this.service.exceptions();
  }

  /** Reconcile every settlement, recording each outcome. */
  @Post('run')
  @RequirePermissions('payments:reconcile')
  run() {
    return this.service.runAll();
  }

  @Post(':id/reconcile')
  @RequirePermissions('payments:reconcile')
  reconcile(@Param('id') id: string) {
    return this.service.reconcile(id);
  }
}
