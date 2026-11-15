import { Module } from '@nestjs/common';
import { ChargebacksController } from './chargebacks.controller';
import { ChargebacksService, CHARGEBACKS_STORE } from './chargebacks.service';
import { InMemoryChargebacksStore } from './chargebacks.store';
import { PayoutsModule } from '../payouts/payouts.module';

@Module({
  imports: [PayoutsModule],
  controllers: [ChargebacksController],
  providers: [
    ChargebacksService,
    { provide: CHARGEBACKS_STORE, useFactory: () => new InMemoryChargebacksStore() },
  ],
})
export class ChargebacksModule {}
