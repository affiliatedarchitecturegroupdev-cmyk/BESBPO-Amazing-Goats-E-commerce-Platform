import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { WebhooksService } from './webhooks.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('payments/webhooks')
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Get()
  @RequirePermissions('payments:read')
  list() { return this.service.list(); }
}
