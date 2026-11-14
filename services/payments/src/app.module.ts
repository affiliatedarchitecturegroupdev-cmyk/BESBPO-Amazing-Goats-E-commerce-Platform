import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PermissionsGuard, AuditInterceptor } from '@ag/nest-auth';
import { HealthController } from './health/health.controller';
import { ProvidersModule } from './providers/providers.module';
import { IntentsModule } from './intents/intents.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { RefundsModule } from './refunds/refunds.module';
import { PayoutsModule } from './payouts/payouts.module';

@Module({
  imports: [
    ProvidersModule,
    IntentsModule,
    WebhooksModule,
    ReconciliationModule,
    RefundsModule,
    PayoutsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
