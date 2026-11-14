import { Module } from '@nestjs/common';
import { DriverSyncController } from './driver-sync.controller';
import { DriverSyncService } from './driver-sync.service';

@Module({ controllers: [DriverSyncController], providers: [DriverSyncService] })
export class DriverSyncModule {}
