import { Module } from '@nestjs/common';
import { SlotsController } from './slots.controller';
import { SlotsService, SLOT_STORE } from './slots.service';
import { InMemorySlotStore } from './slots.store';

@Module({
  controllers: [SlotsController],
  providers: [SlotsService, { provide: SLOT_STORE, useFactory: () => new InMemorySlotStore() }],
  exports: [SLOT_STORE],
})
export class SlotsModule {}
