import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { Role } from '@ag/rbac';
import { AccessService } from './access.service';

class RoleChangeDto {
  subjectId!: string;
  from!: Role[];
  to!: Role[];
}

class ElevationDto {
  subjectId!: string;
  role!: Role;
  reason!: string;
  minutes!: number;
}

/** Roles and access management. Every route is behind RequirePermissions. */
@Controller('identity/access')
export class AccessController {
  constructor(private readonly service: AccessService) {}

  @Get('role-changes')
  @RequirePermissions('roles:manage')
  listRoleChanges() {
    return this.service.listRoleChanges();
  }

  @Post('role-changes')
  @RequirePermissions('roles:manage')
  requestRoleChange(@Req() req: any, @Body() body: RoleChangeDto) {
    return this.service.requestRoleChange(body, userFromRequest(req)?.id ?? 'unknown');
  }

  @Post('role-changes/:id/approve')
  @RequirePermissions('roles:manage')
  approveRoleChange(@Req() req: any, @Param('id') id: string) {
    const approver = userFromRequest(req)?.id;
    return this.service.approveRoleChange(id, approver ?? '');
  }

  @Get('elevations')
  @RequirePermissions('roles:manage')
  listElevations() {
    return this.service.listElevations();
  }

  @Post('elevations')
  @RequirePermissions('system:break_glass')
  requestElevation(@Req() req: any, @Body() body: ElevationDto) {
    return this.service.requestElevation(body, userFromRequest(req)?.id ?? 'unknown');
  }
}
