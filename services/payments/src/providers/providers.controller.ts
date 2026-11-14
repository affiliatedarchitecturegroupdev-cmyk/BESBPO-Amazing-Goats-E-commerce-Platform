import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { ProvidersService } from './providers.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('payments/providers')
export class ProvidersController {
  constructor(private readonly service: ProvidersService) {}

  @Get()
  @RequirePermissions('payments:read')
  list() { return this.service.list(); }
}
