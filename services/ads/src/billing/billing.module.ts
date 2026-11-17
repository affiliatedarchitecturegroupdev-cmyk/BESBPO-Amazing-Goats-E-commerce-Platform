import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { BillingController } from './billing.controller';
import { BillingService, BILLING_STORE } from './billing.service';
import { BillingStore, InMemoryBillingStore } from './billing.store';
import { PgBillingStore } from './billing.sql-store';

@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    {
      provide: BILLING_STORE,
      useFactory: (db?: Db) =>
        selectStore<BillingStore>(new InMemoryBillingStore(), () => new PgBillingStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [BILLING_STORE, BillingService],
})
export class BillingModule {}
