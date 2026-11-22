import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { ZonesController } from './zones.controller';
import { ZonesService, ZONE_STORE } from './zones.service';
import { InMemoryZoneStore, ZoneStore } from './zones.store';
import { PgZoneStore } from './zones.sql-store';
import { RoutesModule } from '../routes/routes.module';
import { SlotsModule } from '../slots/slots.module';

@Module({
  imports: [RoutesModule, SlotsModule],
  controllers: [ZonesController],
  providers: [
    ZonesService,
    {
      provide: ZONE_STORE,
      useFactory: (db?: Db) =>
        selectStore<ZoneStore>(new InMemoryZoneStore(), () => new PgZoneStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [ZONE_STORE],
})
export class ZonesModule {}
