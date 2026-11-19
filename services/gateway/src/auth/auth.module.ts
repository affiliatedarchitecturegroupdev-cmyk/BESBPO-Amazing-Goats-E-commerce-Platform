import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AUTH_OPTIONS, authOptionsFromEnv } from '@ag/nest-auth';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OIDC_CONFIG, OIDC_HTTP, OidcService, oidcConfigFromEnv } from './oidc.service';
import { STAFF_ALLOWLIST, StaffAllowlistGuard } from './staff-allowlist.guard';
import { SessionMiddleware } from './session.middleware';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: AUTH_OPTIONS, useFactory: () => authOptionsFromEnv() },
    { provide: OIDC_CONFIG, useFactory: () => oidcConfigFromEnv() },
    { provide: OIDC_HTTP, useValue: undefined },
    { provide: OidcService, useClass: OidcService },
    { provide: STAFF_ALLOWLIST, useFactory: () => process.env.STAFF_IP_ALLOWLIST },
    // Scoped to staff callers, so it can guard every route without blocking
    // external users; see the guard's comment.
    { provide: APP_GUARD, useClass: StaffAllowlistGuard },
  ],
  exports: [AuthService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessionMiddleware).forRoutes('*');
  }
}
