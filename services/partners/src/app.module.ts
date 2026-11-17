import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PermissionsGuard, AuditInterceptor } from '@ag/nest-auth';
import { PersistenceModule, SessionMiddleware } from '@ag/nest-db';
import { HealthController } from './health/health.controller';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { SlotsModule } from './slots/slots.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [PersistenceModule, PurchaseOrdersModule, SlotsModule, DocumentsModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: PermissionsGuard }, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Every route, so the RLS session is set before any store runs.
    consumer.apply(SessionMiddleware).forRoutes('*');
  }
}
