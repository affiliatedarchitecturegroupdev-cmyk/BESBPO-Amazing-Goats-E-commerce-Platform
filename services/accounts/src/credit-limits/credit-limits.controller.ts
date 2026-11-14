import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { CreditLimitsService } from './credit-limits.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('accounts/credit-limits')
export class CreditLimitsController {
  constructor(private readonly service: CreditLimitsService) {}

  @Get()
  @RequirePermissions('credit:read')
  list() { return this.service.list(); }
}
