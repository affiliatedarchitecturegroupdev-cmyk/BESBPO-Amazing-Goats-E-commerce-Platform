import { Module } from '@nestjs/common';
import { DriverSyncController } from './driver-sync.controller';
import { DriverSyncService, SYNC_EVENT_STORE } from './driver-sync.service';
import { InMemorySyncEventStore } from './driver-sync.store';

@Module({
  controllers: [DriverSyncController],
  providers: [DriverSyncService, { provide: SYNC_EVENT_STORE, useFactory: () => new InMemorySyncEventStore() }],
})
export class DriverSyncModule {}
