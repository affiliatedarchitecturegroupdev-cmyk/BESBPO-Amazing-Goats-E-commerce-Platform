import { Module } from '@nestjs/common';
import { TraceabilityController } from './traceability.controller';
import { TraceabilityService, MOVEMENT_SOURCE, ORDER_SOURCE } from './traceability.service';
import { InMemoryMovementSource, InMemoryOrderSource } from './traceability.store';
import { BatchesModule } from '../batches/batches.module';

@Module({
  imports: [BatchesModule],
  controllers: [TraceabilityController],
  providers: [
    TraceabilityService,
    { provide: MOVEMENT_SOURCE, useFactory: () => new InMemoryMovementSource() },
    { provide: ORDER_SOURCE, useFactory: () => new InMemoryOrderSource() },
  ],
  exports: [MOVEMENT_SOURCE, ORDER_SOURCE],
})
export class TraceabilityModule {}
