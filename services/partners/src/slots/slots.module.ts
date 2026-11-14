import { Module } from '@nestjs/common';
import { SlotsController } from './slots.controller';
import { SlotsService } from './slots.service';
import { InMemoryPartnerStore, PARTNER_STORE } from '../partner.store';

@Module({
  controllers: [SlotsController],
  providers: [SlotsService, { provide: PARTNER_STORE, useFactory: () => new InMemoryPartnerStore() }],
})
export class SlotsModule {}
