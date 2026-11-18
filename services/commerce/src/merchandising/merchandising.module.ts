import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { CatalogModule } from '../catalog/catalog.module';
import { MerchandisingController } from './merchandising.controller';
import { MERCHANDISING_STORE, MerchandisingService } from './merchandising.service';
import { InMemoryMerchandisingStore, MerchandisingStore } from './merchandising.store';
import { PgMerchandisingStore } from './merchandising.sql-store';

/**
 * The merchandising store for the active driver: in-memory by default, the SQL
 * adapter when `STORE_DRIVER=sql`. Exported so a test can assert the switch
 * without booting the module.
 */
export function merchandisingStore(db?: Db): MerchandisingStore {
  return selectStore<MerchandisingStore>(
    new InMemoryMerchandisingStore(),
    () => new PgMerchandisingStore(db!),
  );
}

@Module({
  imports: [CatalogModule],
  controllers: [MerchandisingController],
  providers: [
    MerchandisingService,
    {
      provide: MERCHANDISING_STORE,
      useFactory: (db?: Db) => merchandisingStore(db),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [MerchandisingService],
})
export class MerchandisingModule {}
