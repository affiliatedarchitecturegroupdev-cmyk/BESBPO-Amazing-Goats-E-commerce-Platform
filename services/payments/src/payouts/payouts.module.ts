import { Module } from '@nestjs/common';
import { PayoutsController } from './payouts.controller';
import { PayoutsService, PAYOUTS_STORE } from './payouts.service';
import { InMemoryPayoutsStore } from './payouts.store';

@Module({
  controllers: [PayoutsController],
  providers: [
    PayoutsService,
    { provide: PAYOUTS_STORE, useFactory: () => new InMemoryPayoutsStore() },
  ],
  exports: [PayoutsService],
})
export class PayoutsModule {}
