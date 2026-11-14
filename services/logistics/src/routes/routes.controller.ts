import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { RoutesService } from './routes.service';
import { Route } from './routes.types';
import { CapacityCheck } from './route-domain';

@Controller('logistics/routes')
export class RoutesController {
  constructor(private readonly service: RoutesService) {}

  @Get()
  @RequirePermissions('routes:read')
  list(): Promise<Route[]> {
    return this.service.list();
  }

  @Get(':id/capacity')
  @RequirePermissions('routes:read')
  capacity(@Param('id') id: string, @Query('boxes') boxes?: string): Promise<CapacityCheck> {
    return this.service.capacity(id, Number(boxes ?? 0));
  }

  @Get(':id')
  @RequirePermissions('routes:read')
  get(@Param('id') id: string): Promise<Route> {
    return this.service.get(id);
  }
}
