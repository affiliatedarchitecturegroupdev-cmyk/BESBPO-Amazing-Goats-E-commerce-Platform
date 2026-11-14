import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { AuthService } from './auth.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('gateway/auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Get()
  @RequirePermissions('users:read')
  list() { return this.service.list(); }
}
