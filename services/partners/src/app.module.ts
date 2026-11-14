import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PermissionsGuard, AuditInterceptor } from '@ag/nest-auth';
import { HealthController } from './health/health.controller';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { SlotsModule } from './slots/slots.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [PurchaseOrdersModule, SlotsModule, DocumentsModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: PermissionsGuard }, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
