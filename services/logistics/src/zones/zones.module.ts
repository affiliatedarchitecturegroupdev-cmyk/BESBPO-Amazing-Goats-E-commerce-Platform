import { Module } from '@nestjs/common';
import { ZonesController } from './zones.controller';
import { ZonesService, ZONE_STORE } from './zones.service';
import { InMemoryZoneStore } from './zones.store';

@Module({
  controllers: [ZonesController],
  providers: [ZonesService, { provide: ZONE_STORE, useFactory: () => new InMemoryZoneStore() }],
  exports: [ZONE_STORE],
})
export class ZonesModule {}
