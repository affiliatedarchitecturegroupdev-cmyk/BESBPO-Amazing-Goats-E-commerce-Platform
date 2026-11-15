import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { ChargebacksController } from './chargebacks.controller';
import { ChargebacksService, CHARGEBACKS_STORE } from './chargebacks.service';
import { InMemoryChargebacksStore, ChargebacksStore } from './chargebacks.store';
import { PgChargebacksStore } from './chargebacks.sql-store';
import { AG_DB } from '../persistence/persistence.module';
import { PayoutsModule } from '../payouts/payouts.module';

@Module({
  imports: [PayoutsModule],
  controllers: [ChargebacksController],
  providers: [
    ChargebacksService,
    {
      provide: CHARGEBACKS_STORE,
      useFactory: (db?: Db) =>
        selectStore<ChargebacksStore>(new InMemoryChargebacksStore(), () => new PgChargebacksStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
})
export class ChargebacksModule {}
