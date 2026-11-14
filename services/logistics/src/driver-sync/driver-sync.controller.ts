import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { DriverSyncService } from './driver-sync.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('logistics/driver-sync')
export class DriverSyncController {
  constructor(private readonly service: DriverSyncService) {}

  @Get()
  @RequirePermissions('delivery:execute')
  list() { return this.service.list(); }
}
