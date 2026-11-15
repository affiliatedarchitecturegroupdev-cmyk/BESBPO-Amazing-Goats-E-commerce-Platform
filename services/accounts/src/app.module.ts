import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PermissionsGuard, AuditInterceptor } from '@ag/nest-auth';
import { PersistenceModule, SessionMiddleware } from '@ag/nest-db';
import { HealthController } from './health/health.controller';
import { CreditApplicationsModule } from './credit-applications/credit-applications.module';
import { CreditLimitsModule } from './credit-limits/credit-limits.module';
import { InvoicesModule } from './invoices/invoices.module';
import { CollectionsModule } from './collections/collections.module';
import { StatementsModule } from './statements/statements.module';

@Module({
  imports: [
    PersistenceModule,
    CreditApplicationsModule,
    CreditLimitsModule,
    InvoicesModule,
    CollectionsModule,
    StatementsModule,
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
