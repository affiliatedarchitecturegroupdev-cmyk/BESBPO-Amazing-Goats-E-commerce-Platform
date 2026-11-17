import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { SlotsController } from './slots.controller';
import { SlotsService, SLOT_STORE } from './slots.service';
import { InMemorySlotStore, SlotStore } from './slots.store';
import { PgSlotStore } from './slots.sql-store';

@Module({
  controllers: [SlotsController],
  providers: [
    SlotsService,
    {
      provide: SLOT_STORE,
      useFactory: (db?: Db) =>
        selectStore<SlotStore>(new InMemorySlotStore(), () => new PgSlotStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [SLOT_STORE],
})
export class SlotsModule {}
