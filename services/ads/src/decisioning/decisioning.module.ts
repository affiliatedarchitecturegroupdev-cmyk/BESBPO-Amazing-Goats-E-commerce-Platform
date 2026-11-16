import { Module } from '@nestjs/common';
import { DecisioningController } from './decisioning.controller';
import { DecisioningService, FREQUENCY_STORE } from './decisioning.service';
import { InMemoryFrequencyStore } from './frequency.store';
import { AdsStoresModule } from '../ads-stores.module';

@Module({
  imports: [AdsStoresModule],
  controllers: [DecisioningController],
  providers: [
    DecisioningService,
    { provide: FREQUENCY_STORE, useFactory: () => new InMemoryFrequencyStore() },
  ],
  exports: [DecisioningService],
})
export class DecisioningModule {}
