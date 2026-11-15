import { Global, Module } from '@nestjs/common';
import { createDb, Db, storeDriver } from '@ag/db';

/** Injection token for the process database handle. */
export const AG_DB = Symbol('AG_DB');

/**
 * Provides the database handle. The pool (and the `DATABASE_URL` check) only
 * runs when `STORE_DRIVER=sql`, so a service left on the in-memory driver boots
 * without a database. Global so every store module can inject it without
 * re-importing.
 */
@Global()
@Module({
  providers: [
    {
      provide: AG_DB,
      useFactory: (): Db | undefined => (storeDriver() === 'sql' ? createDb() : undefined),
    },
  ],
  exports: [AG_DB],
})
export class PersistenceModule {}
