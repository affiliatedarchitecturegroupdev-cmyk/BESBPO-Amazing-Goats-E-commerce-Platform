import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { PayoutsService } from './payouts.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('payments/payouts')
export class PayoutsController {
  constructor(private readonly service: PayoutsService) {}

  @Get()
  @RequirePermissions('payouts:request')
  list() { return this.service.list(); }
}
