import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { RefundsService } from './refunds.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('payments/refunds')
export class RefundsController {
  constructor(private readonly service: RefundsService) {}

  @Get()
  @RequirePermissions('refunds:request')
  list() { return this.service.list(); }
}
