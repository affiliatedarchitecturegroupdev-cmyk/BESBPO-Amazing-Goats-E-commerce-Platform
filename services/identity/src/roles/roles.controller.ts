import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { RolesService } from './roles.service';

@Controller('identity/roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get()
  @RequirePermissions('roles:manage')
  list() { return this.service.list(); }

  @Get('permissions')
  @RequirePermissions('roles:manage')
  permissions() { return this.service.permissions(); }
}
