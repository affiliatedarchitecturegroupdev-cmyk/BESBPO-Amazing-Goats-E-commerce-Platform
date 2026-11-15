import { Module } from '@nestjs/common';
import { RefundsController } from './refunds.controller';
import { RefundsService, REFUNDS_STORE } from './refunds.service';
import { InMemoryRefundsStore } from './refunds.store';

@Module({
  controllers: [RefundsController],
  providers: [
    RefundsService,
    { provide: REFUNDS_STORE, useFactory: () => new InMemoryRefundsStore() },
  ],
})
export class RefundsModule {}
