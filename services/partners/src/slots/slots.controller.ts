import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { SlotsService } from './slots.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('partners/slots')
export class SlotsController {
  constructor(private readonly service: SlotsService) {}

  @Get()
  @RequirePermissions('procurement:manage')
  list() { return this.service.list(); }
}
