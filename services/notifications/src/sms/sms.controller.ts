import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { SmsService } from './sms.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('notifications/sms')
export class SmsController {
  constructor(private readonly service: SmsService) {}

  @Get()
  @RequirePermissions('support:manage')
  list() { return this.service.list(); }
}
