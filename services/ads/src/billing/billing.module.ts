import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService, BILLING_STORE } from './billing.service';
import { InMemoryBillingStore } from './billing.store';

@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    { provide: BILLING_STORE, useFactory: () => new InMemoryBillingStore() },
  ],
  exports: [BILLING_STORE, BillingService],
})
export class BillingModule {}
