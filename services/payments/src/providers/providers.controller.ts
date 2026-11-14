import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { ProvidersService } from './providers.service';
import type { ProviderDescriptor } from './providers.service';

@Controller('payments/providers')
export class ProvidersController {
  constructor(private readonly service: ProvidersService) {}

  @Get()
  @RequirePermissions('payments:read')
  list(): ProviderDescriptor[] {
    return this.service.list();
  }
}
