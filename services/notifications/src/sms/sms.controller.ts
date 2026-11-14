import { Body, Controller, Get, Post } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { SmsService } from './sms.service';
import type { SendTemplateInput } from '../dispatch/send-template';
import type { DispatchRecord } from '../dispatch/dispatch';

@Controller('notifications/sms')
export class SmsController {
  constructor(private readonly service: SmsService) {}

  @Get()
  @RequirePermissions('support:manage')
  list(): DispatchRecord[] {
    return this.service.list();
  }

  @Post()
  @RequirePermissions('support:manage')
  send(@Body() body: SendTemplateInput): Promise<DispatchRecord> {
    return this.service.send(body);
  }
}
