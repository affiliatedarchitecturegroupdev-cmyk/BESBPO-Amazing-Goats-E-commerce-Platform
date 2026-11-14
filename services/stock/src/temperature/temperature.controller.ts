import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { TemperatureService } from './temperature.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('stock/temperature')
export class TemperatureController {
  constructor(private readonly service: TemperatureService) {}

  @Get()
  @RequirePermissions('stock:read')
  list() { return this.service.list(); }
}
