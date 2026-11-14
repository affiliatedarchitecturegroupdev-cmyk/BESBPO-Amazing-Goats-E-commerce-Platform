import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { PurchaseOrdersService } from './purchase-orders.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('partners/purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  @Get()
  @RequirePermissions('procurement:manage')
  list() { return this.service.list(); }
}
