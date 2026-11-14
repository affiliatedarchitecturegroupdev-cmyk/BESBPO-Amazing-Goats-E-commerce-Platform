import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { CollectionsService } from './collections.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('accounts/collections')
export class CollectionsController {
  constructor(private readonly service: CollectionsService) {}

  @Get()
  @RequirePermissions('credit:write')
  list() { return this.service.list(); }
}
