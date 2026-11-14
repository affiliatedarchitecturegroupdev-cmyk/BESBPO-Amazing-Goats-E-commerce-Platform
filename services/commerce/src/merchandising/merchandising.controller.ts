import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { MerchandisingService } from './merchandising.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('commerce/merchandising')
export class MerchandisingController {
  constructor(private readonly service: MerchandisingService) {}

  @Get()
  @RequirePermissions('merch:manage')
  list() { return this.service.list(); }
}
