import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { TraceabilityController } from './traceability.controller';
import {
  TraceabilityService,
  MOVEMENT_SOURCE,
  ORDER_SOURCE,
  MovementSource,
  OrderSource,
} from './traceability.service';
import { InMemoryMovementSource, InMemoryOrderSource } from './traceability.store';
import { PgMovementSource, PgOrderSource } from './traceability.sql-store';
import { BatchesModule } from '../batches/batches.module';

@Module({
  imports: [BatchesModule],
  controllers: [TraceabilityController],
  providers: [
    TraceabilityService,
    {
      provide: MOVEMENT_SOURCE,
      useFactory: (db?: Db) =>
        selectStore<MovementSource>(new InMemoryMovementSource(), () => new PgMovementSource(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
    {
      provide: ORDER_SOURCE,
      useFactory: (db?: Db) =>
        selectStore<OrderSource>(new InMemoryOrderSource(), () => new PgOrderSource(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [MOVEMENT_SOURCE, ORDER_SOURCE],
})
export class TraceabilityModule {}
