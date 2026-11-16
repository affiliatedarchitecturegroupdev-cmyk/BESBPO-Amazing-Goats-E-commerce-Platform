import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { CYCLE_SOURCE, SUBSCRIPTION_STORE, SubscriptionsService } from './subscriptions.service';
import { InMemorySubscriptionStore } from './subscriptions.store';
import { CyclesModule } from '../cycles/cycles.module';
import { CYCLE_STORE } from '../cycles/cycles.service';

@Module({
  imports: [CyclesModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    { provide: SUBSCRIPTION_STORE, useFactory: () => new InMemorySubscriptionStore() },
    { provide: CYCLE_SOURCE, useExisting: CYCLE_STORE },
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
