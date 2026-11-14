import { Module } from '@nestjs/common';
import { ProvidersController } from './providers.controller';
import { ProvidersService, PROVIDER_REGISTRY, providersFromEnv } from './providers.service';

@Module({
  controllers: [ProvidersController],
  providers: [
    ProvidersService,
    { provide: PROVIDER_REGISTRY, useFactory: () => providersFromEnv() },
  ],
  exports: [ProvidersService],
})
export class ProvidersModule {}
