import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { RateLimitService } from './rate-limit.service';

/** Read-only view of the effective rate-limit rules, for operators. */
@Controller('gateway/rate-limit')
export class RateLimitController {
  constructor(private readonly service: RateLimitService) {}

  @Get()
  @RequirePermissions('audit:read')
  limits() {
    return this.service.limits();
  }
}
