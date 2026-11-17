import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { SubscriptionsController } from './subscriptions.controller';
import { CYCLE_SOURCE, SUBSCRIPTION_STORE, SubscriptionsService } from './subscriptions.service';
import { InMemorySubscriptionStore, SubscriptionStore } from './subscriptions.store';
import { PgSubscriptionStore } from './subscriptions.sql-store';
import { CyclesModule } from '../cycles/cycles.module';
import { CYCLE_STORE } from '../cycles/cycles.service';

@Module({
  imports: [CyclesModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    {
      provide: SUBSCRIPTION_STORE,
      useFactory: (db?: Db) =>
        selectStore<SubscriptionStore>(
          new InMemorySubscriptionStore(),
          () => new PgSubscriptionStore(db!),
        ),
      inject: [{ token: AG_DB, optional: true }],
    },
    { provide: CYCLE_SOURCE, useExisting: CYCLE_STORE },
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
