import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PermissionsGuard, AuditInterceptor } from '@ag/nest-auth';
import { HealthController } from './health/health.controller';
import { BatchesModule } from './batches/batches.module';
import { TraceabilityModule } from './traceability/traceability.module';
import { TemperatureModule } from './temperature/temperature.module';
import { RecallsModule } from './recalls/recalls.module';

@Module({
  imports: [BatchesModule, TraceabilityModule, TemperatureModule, RecallsModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: PermissionsGuard }, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
