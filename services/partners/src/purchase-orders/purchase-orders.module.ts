import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { InMemoryPartnerStore, PartnerStore, PARTNER_STORE } from '../partner.store';
import { PgPartnerStore } from '../partner.sql-store';

@Module({
  controllers: [PurchaseOrdersController],
  providers: [
    PurchaseOrdersService,
    {
      provide: PARTNER_STORE,
      useFactory: (db?: Db) =>
        selectStore<PartnerStore>(new InMemoryPartnerStore(), () => new PgPartnerStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
})
export class PurchaseOrdersModule {}
