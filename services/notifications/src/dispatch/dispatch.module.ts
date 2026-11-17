import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { DispatchService, CONSENT_STORE, DISPATCH_LOG, TRANSPORTS } from './dispatch.service';
import { DispatchLog, InMemoryDispatchLog } from './dispatch';
import { PgDispatchLog } from './dispatch.sql-store';
import { ConsentStore, InMemoryConsentStore } from '../consent/consent';
import { PgConsentStore } from '../consent/consent.sql-store';
import { transportsFromEnv } from '../channels/transports';

@Module({
  providers: [
    DispatchService,
    {
      provide: CONSENT_STORE,
      useFactory: (db?: Db) =>
        selectStore<ConsentStore>(new InMemoryConsentStore(), () => new PgConsentStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
    {
      provide: DISPATCH_LOG,
      useFactory: (db?: Db) =>
        selectStore<DispatchLog>(new InMemoryDispatchLog(), () => new PgDispatchLog(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
    { provide: TRANSPORTS, useFactory: () => transportsFromEnv() },
  ],
  exports: [DispatchService],
})
export class DispatchModule {}
