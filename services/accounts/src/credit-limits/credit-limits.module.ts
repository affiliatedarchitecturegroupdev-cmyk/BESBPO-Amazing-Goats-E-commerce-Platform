import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { CreditLimitsController } from './credit-limits.controller';
import { CreditLimitsService, CREDIT_LIMITS_STORE } from './credit-limits.service';
import { CreditLimitsStore, InMemoryCreditLimitsStore } from './credit-limits.store';
import { PgCreditLimitsStore } from './credit-limits.sql-store';

@Module({
  controllers: [CreditLimitsController],
  providers: [
    CreditLimitsService,
    {
      provide: CREDIT_LIMITS_STORE,
      useFactory: (db?: Db) =>
        selectStore<CreditLimitsStore>(new InMemoryCreditLimitsStore(), () => new PgCreditLimitsStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [CREDIT_LIMITS_STORE, CreditLimitsService],
})
export class CreditLimitsModule {}
