import { Module } from '@nestjs/common';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';
import { MFA_STORE, InMemoryMfaStore } from './mfa-domain';

@Module({
  controllers: [MfaController],
  providers: [MfaService, { provide: MFA_STORE, useFactory: () => new InMemoryMfaStore() }],
})
export class MfaModule {}
