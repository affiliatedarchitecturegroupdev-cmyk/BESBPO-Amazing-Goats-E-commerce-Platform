import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { InMemorySupplierApplicationStore, OnboardingService, SUPPLIER_APPLICATION_STORE } from './onboarding.service';

@Module({
  controllers: [OnboardingController],
  providers: [
    OnboardingService,
    { provide: SUPPLIER_APPLICATION_STORE, useFactory: () => new InMemorySupplierApplicationStore() },
  ],
})
export class OnboardingModule {}
