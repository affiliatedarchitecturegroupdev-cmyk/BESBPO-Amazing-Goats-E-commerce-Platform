import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PermissionsGuard, AuditInterceptor } from '@ag/nest-auth';
import { HealthController } from './health/health.controller';
import { RoutesModule } from './routes/routes.module';
import { SlotsModule } from './slots/slots.module';
import { ZonesModule } from './zones/zones.module';
import { DriverSyncModule } from './driver-sync/driver-sync.module';
import { ProofOfDeliveryModule } from './proof-of-delivery/proof-of-delivery.module';

@Module({
  imports: [RoutesModule, SlotsModule, ZonesModule, DriverSyncModule, ProofOfDeliveryModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: PermissionsGuard }, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
