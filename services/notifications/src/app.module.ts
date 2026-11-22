import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PermissionsGuard, AuditInterceptor } from '@ag/nest-auth';
import { PersistenceModule, SessionMiddleware } from '@ag/nest-db';
import { HealthController } from './health/health.controller';
import { DispatchModule } from './dispatch/dispatch.module';
import { EmailModule } from './email/email.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { SmsModule } from './sms/sms.module';
import { DeliveryModule } from './delivery/delivery.module';

@Module({
  imports: [
    PersistenceModule,
    DispatchModule,
    EmailModule,
    WhatsappModule,
    SmsModule,
    DeliveryModule,
  ],
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
