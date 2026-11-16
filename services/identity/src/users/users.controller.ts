import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { Role } from '@ag/rbac';
import { UsersService } from './users.service';
import { MemberRole, UserStatus } from './users.types';

class CreateUserDto {
  idpSubject!: string;
  email!: string;
  fullName?: string | null;
  phone?: string | null;
}

class StatusDto {
  status!: UserStatus;
}

class RolesDto {
  roles!: Role[];
}

class MemberRoleDto {
  subjectId!: string;
  to!: MemberRole;
}

/**
 * User administration. Reads are behind `users:read`, every write behind
 * `users:manage`; the org invariants are enforced in the service.
 */
@Controller('identity/users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @RequirePermissions('users:read')
  list() {
    return this.service.list();
  }

  @Get(':id')
  @RequirePermissions('users:read')
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }

  @Post()
  @RequirePermissions('users:manage')
  create(@Req() req: any, @Body() body: CreateUserDto) {
    return this.service.create(body, userFromRequest(req)?.id ?? 'unknown');
  }

  @Patch(':id/status')
  @RequirePermissions('users:manage')
  setStatus(@Param('id') id: string, @Body() body: StatusDto) {
    return this.service.setStatus(id, body.status);
  }

  @Get(':id/roles')
  @RequirePermissions('users:read')
  roles(@Param('id') id: string) {
    return this.service.rolesFor(id);
  }

  @Patch(':id/roles')
  @RequirePermissions('users:manage')
  setRoles(@Req() req: any, @Param('id') id: string, @Body() body: RolesDto) {
    return this.service.setRoles(id, body.roles, userFromRequest(req)?.id ?? 'unknown');
  }

  @Get(':id/memberships')
  @RequirePermissions('users:read')
  memberships(@Param('id') id: string) {
    return this.service.membershipsFor(id);
  }

  @Patch('orgs/:orgId/members/:subjectId')
  @RequirePermissions('users:manage')
  changeMemberRole(
    @Req() req: any,
    @Param('orgId') orgId: string,
    @Param('subjectId') subjectId: string,
    @Body() body: MemberRoleDto,
  ) {
    return this.service.changeMemberRole({ orgId, subjectId, to: body.to }, userFromRequest(req)?.id ?? 'unknown');
  }
}
