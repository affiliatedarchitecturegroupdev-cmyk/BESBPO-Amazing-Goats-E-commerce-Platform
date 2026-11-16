import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PermissionsGuard, AuditInterceptor, AUTH_OPTIONS, authOptionsFromEnv } from '@ag/nest-auth';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { BffModule } from './bff/bff.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { RateLimitGuard } from './rate-limit/rate-limit.guard';

@Module({
  imports: [AuthModule, BffModule, RateLimitModule],
  controllers: [HealthController],
  providers: [
    { provide: AUTH_OPTIONS, useFactory: () => authOptionsFromEnv() },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // After the permission guard, so a signed-in caller is keyed by user.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
