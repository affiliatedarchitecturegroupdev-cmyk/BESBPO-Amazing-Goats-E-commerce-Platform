import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { PayoutsController } from './payouts.controller';
import { PayoutsService, PAYOUTS_STORE } from './payouts.service';
import { InMemoryPayoutsStore, PayoutsStore } from './payouts.store';
import { PgPayoutsStore } from './payouts.sql-store';
import { AG_DB } from '@ag/nest-db';

@Module({
  controllers: [PayoutsController],
  providers: [
    PayoutsService,
    {
      provide: PAYOUTS_STORE,
      useFactory: (db?: Db) =>
        selectStore<PayoutsStore>(new InMemoryPayoutsStore(), () => new PgPayoutsStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [PayoutsService],
})
export class PayoutsModule {}
