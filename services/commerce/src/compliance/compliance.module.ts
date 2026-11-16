import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ComplianceController } from './compliance.controller';
import { COMPLIANCE_STORE, ComplianceService, InMemoryComplianceStore } from './compliance.service';

@Module({
  imports: [CatalogModule],
  controllers: [ComplianceController],
  providers: [
    ComplianceService,
    { provide: COMPLIANCE_STORE, useFactory: () => new InMemoryComplianceStore() },
  ],
})
export class ComplianceModule {}
