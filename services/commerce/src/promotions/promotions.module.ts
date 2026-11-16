import { Module } from '@nestjs/common';
import { PromotionsController } from './promotions.controller';
import { PROMOTION_STORE, PromotionsService } from './promotions.service';
import { InMemoryPromotionStore } from './promotions.store';

@Module({
  controllers: [PromotionsController],
  providers: [
    PromotionsService,
    { provide: PROMOTION_STORE, useFactory: () => new InMemoryPromotionStore() },
  ],
  exports: [PromotionsService],
})
export class PromotionsModule {}
