import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { BatchesController } from './batches.controller';
import { BatchesService, BATCH_STORE } from './batches.service';
import { InMemoryBatchStore, BatchStore } from './batches.store';
import { PgBatchStore } from './batches.sql-store';

@Module({
  controllers: [BatchesController],
  providers: [
    BatchesService,
    {
      provide: BATCH_STORE,
      useFactory: (db?: Db) =>
        selectStore<BatchStore>(new InMemoryBatchStore(), () => new PgBatchStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [BATCH_STORE],
})
export class BatchesModule {}
