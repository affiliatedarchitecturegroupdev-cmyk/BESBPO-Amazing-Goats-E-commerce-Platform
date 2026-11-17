import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { CatalogModule } from '../catalog/catalog.module';
import { ComplianceController } from './compliance.controller';
import { COMPLIANCE_STORE, ComplianceService, ComplianceStore, InMemoryComplianceStore } from './compliance.service';
import { PgComplianceStore } from './compliance.sql-store';

@Module({
  imports: [CatalogModule],
  controllers: [ComplianceController],
  providers: [
    ComplianceService,
    {
      provide: COMPLIANCE_STORE,
      useFactory: (db?: Db) =>
        selectStore<ComplianceStore>(new InMemoryComplianceStore(), () => new PgComplianceStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
})
export class ComplianceModule {}
