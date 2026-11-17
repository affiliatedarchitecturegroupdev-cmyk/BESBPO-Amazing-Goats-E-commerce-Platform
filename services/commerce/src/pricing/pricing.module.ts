import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { PricingController } from './pricing.controller';
import { PRICING_STORE, PricingService } from './pricing.service';
import { PricingStore, seedPricingStore } from './pricing.store';
import { PgPricingStore } from './pricing.sql-store';

@Module({
  controllers: [PricingController],
  providers: [
    PricingService,
    {
      provide: PRICING_STORE,
      useFactory: (db?: Db) =>
        selectStore<PricingStore>(seedPricingStore(), () => new PgPricingStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [PricingService],
})
export class PricingModule {}
