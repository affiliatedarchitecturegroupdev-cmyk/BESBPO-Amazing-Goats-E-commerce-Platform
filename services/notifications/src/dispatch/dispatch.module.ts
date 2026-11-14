import { Module } from '@nestjs/common';
import { DispatchService, CONSENT_STORE, DISPATCH_LOG, TRANSPORTS } from './dispatch.service';
import { InMemoryDispatchLog } from './dispatch';
import { InMemoryConsentStore } from '../consent/consent';
import { transportsFromEnv } from '../channels/transports';

@Module({
  providers: [
    DispatchService,
    { provide: CONSENT_STORE, useFactory: () => new InMemoryConsentStore() },
    { provide: DISPATCH_LOG, useFactory: () => new InMemoryDispatchLog() },
    { provide: TRANSPORTS, useFactory: () => transportsFromEnv() },
  ],
  exports: [DispatchService],
})
export class DispatchModule {}
