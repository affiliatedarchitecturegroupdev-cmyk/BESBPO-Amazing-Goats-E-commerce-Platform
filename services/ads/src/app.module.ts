import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PermissionsGuard, AuditInterceptor } from '@ag/nest-auth';
import { HealthController } from './health/health.controller';
import { CampaignsModule } from './campaigns/campaigns.module';
import { CreativesModule } from './creatives/creatives.module';
import { DecisioningModule } from './decisioning/decisioning.module';
import { BillingModule } from './billing/billing.module';
import { ReportingModule } from './reporting/reporting.module';

@Module({
  imports: [CampaignsModule, CreativesModule, DecisioningModule, BillingModule, ReportingModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: PermissionsGuard }, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
