import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { WhatsappService } from './whatsapp.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('notifications/whatsapp')
export class WhatsappController {
  constructor(private readonly service: WhatsappService) {}

  @Get()
  @RequirePermissions('support:manage')
  list() { return this.service.list(); }
}
