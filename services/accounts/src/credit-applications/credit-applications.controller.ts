import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { CreditApplicationsService } from './credit-applications.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('accounts/credit-applications')
export class CreditApplicationsController {
  constructor(private readonly service: CreditApplicationsService) {}

  @Get()
  @RequirePermissions('credit:read')
  list() { return this.service.list(); }
}
