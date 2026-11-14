import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { StatementsService } from './statements.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('accounts/statements')
export class StatementsController {
  constructor(private readonly service: StatementsService) {}

  @Get()
  @RequirePermissions('invoices:read')
  list() { return this.service.list(); }
}
