import { Body, Controller, Post, Req } from '@nestjs/common';
import { userFromRequest } from '@ag/nest-auth';
import { MfaService } from './mfa.service';

class ConfirmDto {
  code!: string;
}

class VerifyDto {
  code!: string;
}

/**
 * MFA enrolment and login verification. These routes run before a session
 * exists, so they are not behind RequirePermissions; the caller is taken from
 * the token.
 */
@Controller('identity/mfa')
export class MfaController {
  constructor(private readonly service: MfaService) {}

  @Post('enrol')
  begin(@Req() req: any, @Body() body: { account?: string }) {
    const user = userFromRequest(req);
    return this.service.beginEnrolment(user?.id ?? 'unknown', body?.account ?? user?.id ?? 'unknown');
  }

  @Post('confirm')
  confirm(@Req() req: any, @Body() body: ConfirmDto) {
    const user = userFromRequest(req);
    return this.service.confirm(user?.id ?? 'unknown', body.code);
  }

  @Post('verify')
  verify(@Req() req: any, @Body() body: VerifyDto) {
    const user = userFromRequest(req);
    return this.service.verify(user?.id ?? 'unknown', body.code);
  }
}
