import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { DriverSyncController } from './driver-sync.controller';
import { DriverSyncService, SYNC_EVENT_STORE } from './driver-sync.service';
import { InMemorySyncEventStore, SyncEventStore } from './driver-sync.store';
import { PgSyncEventStore } from './driver-sync.sql-store';

@Module({
  controllers: [DriverSyncController],
  providers: [
    DriverSyncService,
    {
      provide: SYNC_EVENT_STORE,
      useFactory: (db?: Db) =>
        selectStore<SyncEventStore>(new InMemorySyncEventStore(), () => new PgSyncEventStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
})
export class DriverSyncModule {}
