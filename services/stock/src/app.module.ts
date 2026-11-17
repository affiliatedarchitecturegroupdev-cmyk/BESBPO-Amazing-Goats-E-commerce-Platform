import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PermissionsGuard, AuditInterceptor } from '@ag/nest-auth';
import { PersistenceModule, SessionMiddleware } from '@ag/nest-db';
import { HealthController } from './health/health.controller';
import { BatchesModule } from './batches/batches.module';
import { TraceabilityModule } from './traceability/traceability.module';
import { TemperatureModule } from './temperature/temperature.module';
import { RecallsModule } from './recalls/recalls.module';

@Module({
  imports: [PersistenceModule, BatchesModule, TraceabilityModule, TemperatureModule, RecallsModule],
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
