import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { DecisioningService } from './decisioning.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('ads/decisioning')
export class DecisioningController {
  constructor(private readonly service: DecisioningService) {}

  @Get()
  @RequirePermissions('ads:read')
  list() { return this.service.list(); }
}
