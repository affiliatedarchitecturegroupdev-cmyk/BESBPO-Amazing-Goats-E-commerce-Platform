import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { RateLimitService } from './rate-limit.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('gateway/rate-limit')
export class RateLimitController {
  constructor(private readonly service: RateLimitService) {}

  @Get()
  @RequirePermissions('audit:read')
  list() { return this.service.list(); }
}
