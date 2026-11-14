import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { DocumentsService } from './documents.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('partners/documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  @RequirePermissions('procurement:manage')
  list() { return this.service.list(); }
}
