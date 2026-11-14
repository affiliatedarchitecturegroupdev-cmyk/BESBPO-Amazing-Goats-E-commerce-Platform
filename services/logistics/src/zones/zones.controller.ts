import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { ZonesService } from './zones.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('logistics/zones')
export class ZonesController {
  constructor(private readonly service: ZonesService) {}

  @Get()
  @RequirePermissions('routes:read')
  list() { return this.service.list(); }
}
