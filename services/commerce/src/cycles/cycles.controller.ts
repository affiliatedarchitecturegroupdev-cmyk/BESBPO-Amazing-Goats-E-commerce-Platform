import { Controller, Get, Post } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { CyclesService } from './cycles.service';

@Controller('commerce/cycles')
export class CyclesController {
  constructor(private readonly service: CyclesService) {}

  @Get()
  @RequirePermissions('cycles:manage')
  list() {
    return this.service.list();
  }

  @Get('current')
  @RequirePermissions('catalog:read')
  current() {
    return this.service.current();
  }

  /** Manual tick for operators; the scheduler runs the same job on a timer. */
  @Post('tick')
  @RequirePermissions('cycles:manage')
  tick() {
    return this.service.tick();
  }
}
