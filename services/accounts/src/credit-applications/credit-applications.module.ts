import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { CreditApplicationsController } from './credit-applications.controller';
import { CreditApplicationsService, CREDIT_APPLICATIONS_STORE } from './credit-applications.service';
import {
  CreditApplicationsStore,
  InMemoryCreditApplicationsStore,
} from './credit-applications.store';
import { PgCreditApplicationsStore } from './credit-applications.sql-store';

@Module({
  controllers: [CreditApplicationsController],
  providers: [
    CreditApplicationsService,
    {
      provide: CREDIT_APPLICATIONS_STORE,
      useFactory: (db?: Db) =>
        selectStore<CreditApplicationsStore>(
          new InMemoryCreditApplicationsStore(),
          () => new PgCreditApplicationsStore(db!),
        ),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [CREDIT_APPLICATIONS_STORE, CreditApplicationsService],
})
export class CreditApplicationsModule {}
