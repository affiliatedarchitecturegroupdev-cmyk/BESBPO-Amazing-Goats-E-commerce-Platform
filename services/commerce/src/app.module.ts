import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PermissionsGuard, AuditInterceptor } from '@ag/nest-auth';
import { PersistenceModule, SessionMiddleware } from '@ag/nest-db';
import { HealthController } from './health/health.controller';
import { CatalogModule } from './catalog/catalog.module';
import { PricingModule } from './pricing/pricing.module';
import { OrdersModule } from './orders/orders.module';
import { CyclesModule } from './cycles/cycles.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PromotionsModule } from './promotions/promotions.module';
import { MerchandisingModule } from './merchandising/merchandising.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { ComplianceModule } from './compliance/compliance.module';

@Module({
  imports: [PersistenceModule, CatalogModule, PricingModule, OrdersModule, CyclesModule, SubscriptionsModule, PromotionsModule, MerchandisingModule, OnboardingModule, ComplianceModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: PermissionsGuard }, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Every route, so the RLS session is set before any store runs.
    consumer.apply(SessionMiddleware).forRoutes('*');
  }
}
