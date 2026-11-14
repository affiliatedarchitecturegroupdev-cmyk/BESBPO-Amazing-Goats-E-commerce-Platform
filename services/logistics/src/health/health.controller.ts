import { Controller, Get } from '@nestjs/common';
import { healthReport } from '@ag/observability';
import type { HealthReport } from '@ag/observability';

@Controller('health')
export class HealthController {
  @Get()
  get(): HealthReport {
    return healthReport({ service: 'logistics' });
  }
}
