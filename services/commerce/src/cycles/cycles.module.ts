import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { CyclesController } from './cycles.controller';
import { CyclesService, CYCLE_STORE } from './cycles.service';
import { CycleScheduler } from './cycle.scheduler';
import { InMemoryCycleStore } from './cycle.store';
import { CycleEngineStore } from './cycle-engine';
import { PgCycleStore } from './cycle.sql-store';

@Module({
  controllers: [CyclesController],
  providers: [
    CyclesService,
    CycleScheduler,
    {
      provide: CYCLE_STORE,
      useFactory: (db?: Db) =>
        selectStore<CycleEngineStore>(new InMemoryCycleStore(), () => new PgCycleStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [CYCLE_STORE],
})
export class CyclesModule {}
