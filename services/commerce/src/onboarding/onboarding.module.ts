import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { OnboardingController } from './onboarding.controller';
import {
  InMemorySupplierApplicationStore,
  OnboardingService,
  SUPPLIER_APPLICATION_STORE,
  SupplierApplicationStore,
} from './onboarding.service';
import { PgSupplierApplicationStore } from './onboarding.sql-store';

@Module({
  controllers: [OnboardingController],
  providers: [
    OnboardingService,
    {
      provide: SUPPLIER_APPLICATION_STORE,
      useFactory: (db?: Db) =>
        selectStore<SupplierApplicationStore>(
          new InMemorySupplierApplicationStore(),
          () => new PgSupplierApplicationStore(db!),
        ),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
})
export class OnboardingModule {}
