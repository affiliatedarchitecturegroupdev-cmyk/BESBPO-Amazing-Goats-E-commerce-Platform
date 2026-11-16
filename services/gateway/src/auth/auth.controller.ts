import { Controller, Get, Req } from '@nestjs/common';
import { RequireAuthenticated } from '@ag/nest-auth';
import { AuthService } from './auth.service';

/**
 * Session endpoints. They are reachable by any signed-in caller
 * (`@RequireAuthenticated`), not one particular permission, since every role
 * needs to see its own session.
 */
@Controller('gateway/auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Get('me')
  @RequireAuthenticated()
  me(@Req() req: any) {
    return this.service.me(req);
  }

  @Get('session')
  @RequireAuthenticated()
  session(@Req() req: any) {
    return this.service.session(req);
  }
}
