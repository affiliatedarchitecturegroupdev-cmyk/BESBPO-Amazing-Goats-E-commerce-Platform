import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PermissionsGuard, AuditInterceptor } from '@ag/nest-auth';
import { HealthController } from './health/health.controller';
import { PersistenceModule, SessionMiddleware } from '@ag/nest-db';
import { ProvidersModule } from './providers/providers.module';
import { IntentsModule } from './intents/intents.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { RefundsModule } from './refunds/refunds.module';
import { PayoutsModule } from './payouts/payouts.module';
import { ChargebacksModule } from './chargebacks/chargebacks.module';

@Module({
  imports: [
    PersistenceModule,
    ProvidersModule,
    IntentsModule,
    WebhooksModule,
    ReconciliationModule,
    RefundsModule,
    PayoutsModule,
    ChargebacksModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Every route, so the RLS session is set before any store runs.
    consumer.apply(SessionMiddleware).forRoutes('*');
  }
}
