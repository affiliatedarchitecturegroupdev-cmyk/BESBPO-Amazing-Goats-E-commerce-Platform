import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { BffService } from './bff.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('gateway/bff')
export class BffController {
  constructor(private readonly service: BffService) {}

  @Get()
  @RequirePermissions('catalog:read')
  list() { return this.service.list(); }
}
