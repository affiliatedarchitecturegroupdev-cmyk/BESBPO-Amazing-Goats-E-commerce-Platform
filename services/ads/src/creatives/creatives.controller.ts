import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { CreativesService } from './creatives.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('ads/creatives')
export class CreativesController {
  constructor(private readonly service: CreativesService) {}

  @Get()
  @RequirePermissions('ads:manage')
  list() { return this.service.list(); }
}
