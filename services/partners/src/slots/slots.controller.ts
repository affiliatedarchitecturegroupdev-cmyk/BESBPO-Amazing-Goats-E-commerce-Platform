import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { SlotsService } from './slots.service';
import { partnerOrgId } from '../partner-scope';

// Every route is behind RequirePermissions and scoped to the caller's org.
@Controller('partners/slots')
export class SlotsController {
  constructor(private readonly service: SlotsService) {}

  @Get()
  @RequirePermissions('procurement:manage')
  list(@Req() req: any, @Query('orgId') orgId?: string) {
    return this.service.list(partnerOrgId(userFromRequest(req), orgId));
  }

  @Post(':id/confirm')
  @RequirePermissions('procurement:manage')
  confirm(@Req() req: any, @Param('id') id: string, @Query('orgId') orgId?: string) {
    return this.service.confirm(partnerOrgId(userFromRequest(req), orgId), id);
  }
}
