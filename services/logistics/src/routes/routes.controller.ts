import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { RoutesService } from './routes.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('logistics/routes')
export class RoutesController {
  constructor(private readonly service: RoutesService) {}

  @Get()
  @RequirePermissions('routes:read')
  list() { return this.service.list(); }
}
