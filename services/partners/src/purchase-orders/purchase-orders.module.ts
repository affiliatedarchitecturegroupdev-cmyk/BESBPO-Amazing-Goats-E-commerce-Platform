import { Module } from '@nestjs/common';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { InMemoryPartnerStore, PARTNER_STORE } from '../partner.store';

@Module({
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService, { provide: PARTNER_STORE, useFactory: () => new InMemoryPartnerStore() }],
})
export class PurchaseOrdersModule {}
