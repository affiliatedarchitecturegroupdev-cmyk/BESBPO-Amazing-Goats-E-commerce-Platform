import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PermissionsGuard, AuditInterceptor, AUTH_OPTIONS, authOptionsFromEnv } from '@ag/nest-auth';
import { HealthController } from './health/health.controller';
import { AssistantModule } from './assistant/assistant.module';
import { AuthModule } from './auth/auth.module';
import { BffModule } from './bff/bff.module';
import { ProxyModule } from './proxy/proxy.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { RateLimitGuard } from './rate-limit/rate-limit.guard';

@Module({
  // ProxyModule is imported last: its catch-all controller is registered after
  // every route the gateway serves itself, so a `/gateway/*` or `/health`
  // request never reaches the proxy.
  imports: [AuthModule, BffModule, AssistantModule, RateLimitModule, ProxyModule],
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
