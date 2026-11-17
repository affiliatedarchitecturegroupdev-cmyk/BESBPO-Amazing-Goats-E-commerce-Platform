import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { RecallsController } from './recalls.controller';
import { RecallsService, RECALL_STORE } from './recalls.service';
import { InMemoryRecallStore, RecallStore } from './recalls.store';
import { PgRecallStore } from './recalls.sql-store';
import { BatchesModule } from '../batches/batches.module';
import { TraceabilityModule } from '../traceability/traceability.module';

@Module({
  imports: [BatchesModule, TraceabilityModule],
  controllers: [RecallsController],
  providers: [
    RecallsService,
    {
      provide: RECALL_STORE,
      useFactory: (db?: Db) =>
        selectStore<RecallStore>(new InMemoryRecallStore(), () => new PgRecallStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
})
export class RecallsModule {}
