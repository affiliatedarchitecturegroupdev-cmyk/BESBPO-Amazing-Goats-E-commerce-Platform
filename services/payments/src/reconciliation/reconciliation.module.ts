import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService, RECONCILIATION_STORE } from './reconciliation.service';
import { InMemoryReconciliationStore, ReconciliationStore } from './reconciliation.store';
import { PgReconciliationStore } from './reconciliation.sql-store';
import { AG_DB } from '../persistence/persistence.module';

@Module({
  controllers: [ReconciliationController],
  providers: [
    ReconciliationService,
    {
      provide: RECONCILIATION_STORE,
      useFactory: (db?: Db) =>
        selectStore<ReconciliationStore>(new InMemoryReconciliationStore(), () => new PgReconciliationStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
})
export class ReconciliationModule {}
