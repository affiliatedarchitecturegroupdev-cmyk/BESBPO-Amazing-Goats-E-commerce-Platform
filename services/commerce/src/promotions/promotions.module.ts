import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { PromotionsController } from './promotions.controller';
import { PROMOTION_STORE, PromotionsService } from './promotions.service';
import { InMemoryPromotionStore, PromotionStore } from './promotions.store';
import { PgPromotionStore } from './promotions.sql-store';

@Module({
  controllers: [PromotionsController],
  providers: [
    PromotionsService,
    {
      provide: PROMOTION_STORE,
      useFactory: (db?: Db) =>
        selectStore<PromotionStore>(new InMemoryPromotionStore(), () => new PgPromotionStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [PromotionsService],
})
export class PromotionsModule {}
