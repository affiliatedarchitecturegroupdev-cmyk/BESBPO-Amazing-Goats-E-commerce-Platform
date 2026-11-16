import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PermissionsGuard, AuditInterceptor } from '@ag/nest-auth';
import { HealthController } from './health/health.controller';
import { CatalogModule } from './catalog/catalog.module';
import { PricingModule } from './pricing/pricing.module';
import { OrdersModule } from './orders/orders.module';
import { CyclesModule } from './cycles/cycles.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PromotionsModule } from './promotions/promotions.module';
import { MerchandisingModule } from './merchandising/merchandising.module';
import { OnboardingModule } from './onboarding/onboarding.module';

@Module({
  imports: [CatalogModule, PricingModule, OrdersModule, CyclesModule, SubscriptionsModule, PromotionsModule, MerchandisingModule, OnboardingModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: PermissionsGuard }, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
