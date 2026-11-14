import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { EmailService } from './email.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('notifications/email')
export class EmailController {
  constructor(private readonly service: EmailService) {}

  @Get()
  @RequirePermissions('support:manage')
  list() { return this.service.list(); }
}
