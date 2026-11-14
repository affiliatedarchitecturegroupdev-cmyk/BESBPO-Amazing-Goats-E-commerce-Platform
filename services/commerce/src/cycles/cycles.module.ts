import { Module } from '@nestjs/common';
import { CyclesController } from './cycles.controller';
import { CyclesService, CYCLE_STORE } from './cycles.service';
import { CycleScheduler } from './cycle.scheduler';
import { InMemoryCycleStore } from './cycle.store';

@Module({
  controllers: [CyclesController],
  providers: [
    CyclesService,
    CycleScheduler,
    { provide: CYCLE_STORE, useFactory: () => new InMemoryCycleStore() },
  ],
  exports: [CYCLE_STORE],
})
export class CyclesModule {}
