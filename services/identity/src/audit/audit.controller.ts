import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { AuditService } from './audit.service';

@Controller('identity/audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @RequirePermissions('audit:read')
  list(@Query('entity') entity?: string, @Query('actor') actorUserId?: string) {
    return this.service.list({ entity, actorUserId });
  }
}
