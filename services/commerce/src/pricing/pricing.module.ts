import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { PRICING_STORE, PricingService } from './pricing.service';
import { seedPricingStore } from './pricing.store';

@Module({
  controllers: [PricingController],
  providers: [PricingService, { provide: PRICING_STORE, useFactory: seedPricingStore }],
  exports: [PricingService],
})
export class PricingModule {}
