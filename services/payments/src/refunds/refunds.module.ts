import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { RefundsController } from './refunds.controller';
import { RefundsService, REFUNDS_STORE } from './refunds.service';
import { InMemoryRefundsStore, RefundsStore } from './refunds.store';
import { PgRefundsStore } from './refunds.sql-store';
import { AG_DB } from '../persistence/persistence.module';

@Module({
  controllers: [RefundsController],
  providers: [
    RefundsService,
    {
      provide: REFUNDS_STORE,
      useFactory: (db?: Db) =>
        selectStore<RefundsStore>(new InMemoryRefundsStore(), () => new PgRefundsStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
})
export class RefundsModule {}
