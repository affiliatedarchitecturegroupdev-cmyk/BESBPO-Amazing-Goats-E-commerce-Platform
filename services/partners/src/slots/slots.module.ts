import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { SlotsController } from './slots.controller';
import { SlotsService } from './slots.service';
import { InMemoryPartnerStore, PartnerStore, PARTNER_STORE } from '../partner.store';
import { PgPartnerStore } from '../partner.sql-store';

@Module({
  controllers: [SlotsController],
  providers: [
    SlotsService,
    {
      provide: PARTNER_STORE,
      useFactory: (db?: Db) =>
        selectStore<PartnerStore>(new InMemoryPartnerStore(), () => new PgPartnerStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
})
export class SlotsModule {}
