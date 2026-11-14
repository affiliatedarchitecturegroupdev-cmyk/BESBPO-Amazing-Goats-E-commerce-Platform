import { Controller, Get, Query, Req } from '@nestjs/common';
import { RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { DocumentsService } from './documents.service';
import { partnerOrgId } from '../partner-scope';

@Controller('partners/documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  @RequirePermissions('procurement:manage')
  list(@Req() req: any, @Query('orgId') orgId?: string) {
    return this.service.list(partnerOrgId(userFromRequest(req), orgId));
  }
}
