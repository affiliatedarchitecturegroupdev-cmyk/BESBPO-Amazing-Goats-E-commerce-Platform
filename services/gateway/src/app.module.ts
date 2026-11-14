import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PermissionsGuard, AuditInterceptor } from '@ag/nest-auth';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { BffModule } from './bff/bff.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';

@Module({
  imports: [AuthModule, BffModule, RateLimitModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: PermissionsGuard }, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
