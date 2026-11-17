import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { CatalogController } from './catalog.controller';
import { CATALOGUE_STORE, CatalogService, seedCatalogueStore } from './catalog.service';
import { CatalogueStore } from './catalog.store';
import { PgCatalogueStore } from './catalog.sql-store';

@Module({
  controllers: [CatalogController],
  providers: [
    CatalogService,
    {
      provide: CATALOGUE_STORE,
      useFactory: (db?: Db) =>
        selectStore<CatalogueStore>(seedCatalogueStore(), () => new PgCatalogueStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [CATALOGUE_STORE],
})
export class CatalogModule {}
