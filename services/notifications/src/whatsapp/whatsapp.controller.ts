import { Body, Controller, Get, Post } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { WhatsappService } from './whatsapp.service';
import type { SendTemplateInput } from '../dispatch/send-template';
import type { DispatchRecord } from '../dispatch/dispatch';

@Controller('notifications/whatsapp')
export class WhatsappController {
  constructor(private readonly service: WhatsappService) {}

  @Get()
  @RequirePermissions('support:manage')
  list(): Promise<DispatchRecord[]> {
    return this.service.list();
  }

  @Post()
  @RequirePermissions('support:manage')
  send(@Body() body: SendTemplateInput): Promise<DispatchRecord> {
    return this.service.send(body);
  }
}
