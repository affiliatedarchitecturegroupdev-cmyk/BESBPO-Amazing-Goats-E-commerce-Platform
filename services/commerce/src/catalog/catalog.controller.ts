import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { CatalogService } from './catalog.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('commerce/catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  @Get()
  @RequirePermissions('catalog:read')
  list() { return this.service.list(); }
}
