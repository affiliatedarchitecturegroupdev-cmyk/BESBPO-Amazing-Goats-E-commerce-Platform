import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { AuditService } from './audit.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('identity/audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @RequirePermissions('audit:read')
  list() { return this.service.list(); }
}
