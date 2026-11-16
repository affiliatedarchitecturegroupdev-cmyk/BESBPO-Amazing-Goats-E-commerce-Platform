import { Module } from '@nestjs/common';
import { AUTH_OPTIONS, authOptionsFromEnv } from '@ag/nest-auth';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, { provide: AUTH_OPTIONS, useFactory: () => authOptionsFromEnv() }],
})
export class AuthModule {}
