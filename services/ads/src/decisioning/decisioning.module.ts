import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { DecisioningController } from './decisioning.controller';
import { DecisioningService, FREQUENCY_STORE } from './decisioning.service';
import { FrequencyStore, InMemoryFrequencyStore } from './frequency.store';
import { PgFrequencyStore } from './frequency.sql-store';
import { AdsStoresModule } from '../ads-stores.module';

@Module({
  imports: [AdsStoresModule],
  controllers: [DecisioningController],
  providers: [
    DecisioningService,
    {
      provide: FREQUENCY_STORE,
      useFactory: (db?: Db) =>
        selectStore<FrequencyStore>(new InMemoryFrequencyStore(), () => new PgFrequencyStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [DecisioningService],
})
export class DecisioningModule {}
