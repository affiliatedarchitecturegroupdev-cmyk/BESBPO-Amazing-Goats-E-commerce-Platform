import { Module } from '@nestjs/common';
import { BatchesController } from './batches.controller';
import { BatchesService, BATCH_STORE } from './batches.service';
import { InMemoryBatchStore } from './batches.store';

@Module({
  controllers: [BatchesController],
  providers: [BatchesService, { provide: BATCH_STORE, useFactory: () => new InMemoryBatchStore() }],
  exports: [BATCH_STORE],
})
export class BatchesModule {}
