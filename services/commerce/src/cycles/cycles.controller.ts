import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { CyclesService } from './cycles.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('commerce/cycles')
export class CyclesController {
  constructor(private readonly service: CyclesService) {}

  @Get()
  @RequirePermissions('cycles:manage')
  list() { return this.service.list(); }
}
