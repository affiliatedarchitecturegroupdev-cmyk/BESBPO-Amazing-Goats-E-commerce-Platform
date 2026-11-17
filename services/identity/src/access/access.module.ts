import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
import { ACCESS_STORE, AccessStore, InMemoryAccessStore } from './access.store';
import { PgAccessStore } from './access.sql-store';

@Module({
  controllers: [AccessController],
  providers: [
    AccessService,
    {
      provide: ACCESS_STORE,
      useFactory: (db?: Db) =>
        selectStore<AccessStore>(new InMemoryAccessStore(), () => new PgAccessStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
})
export class AccessModule {}
