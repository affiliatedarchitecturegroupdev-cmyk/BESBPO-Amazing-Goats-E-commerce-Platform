import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { BillingService } from './billing.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('ads/billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get()
  @RequirePermissions('ads:manage')
  list() { return this.service.list(); }
}
