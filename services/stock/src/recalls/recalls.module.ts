import { Module } from '@nestjs/common';
import { RecallsController } from './recalls.controller';
import { RecallsService, RECALL_STORE } from './recalls.service';
import { InMemoryRecallStore } from './recalls.store';
import { BatchesModule } from '../batches/batches.module';
import { TraceabilityModule } from '../traceability/traceability.module';

@Module({
  imports: [BatchesModule, TraceabilityModule],
  controllers: [RecallsController],
  providers: [RecallsService, { provide: RECALL_STORE, useFactory: () => new InMemoryRecallStore() }],
})
export class RecallsModule {}
