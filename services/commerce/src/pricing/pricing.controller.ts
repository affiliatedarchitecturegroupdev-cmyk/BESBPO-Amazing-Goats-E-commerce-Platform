import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { PricingService } from './pricing.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('commerce/pricing')
export class PricingController {
  constructor(private readonly service: PricingService) {}

  @Get()
  @RequirePermissions('pricing:read')
  list() { return this.service.list(); }
}
