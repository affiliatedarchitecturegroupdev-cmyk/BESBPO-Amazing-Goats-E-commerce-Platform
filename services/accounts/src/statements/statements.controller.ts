import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { StatementsService } from './statements.service';
import { Statement } from './statement.rules';

@Controller('accounts/statements')
export class StatementsController {
  constructor(private readonly service: StatementsService) {}

  /** A trade customer's statement at a date; defaults to today. */
  @Get(':orgId')
  @RequirePermissions('invoices:read')
  forOrg(
    @Param('orgId') orgId: string,
    @Query('asOf') asOf?: string,
  ): Promise<Statement> {
    return this.service.forOrg(orgId, asOf ?? new Date().toISOString().slice(0, 10));
  }
}
