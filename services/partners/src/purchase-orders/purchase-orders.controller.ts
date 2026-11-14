import { Controller, Get, Query, Req } from '@nestjs/common';
import { RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { PurchaseOrdersService } from './purchase-orders.service';
import { partnerOrgId } from '../partner-scope';

@Controller('partners/purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  @Get()
  @RequirePermissions('procurement:manage')
  list(@Req() req: any, @Query('orgId') orgId?: string) {
    return this.service.list(partnerOrgId(userFromRequest(req), orgId));
  }
}
