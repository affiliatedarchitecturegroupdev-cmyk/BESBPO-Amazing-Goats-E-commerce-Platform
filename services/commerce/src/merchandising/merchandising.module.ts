import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { CatalogModule } from '../catalog/catalog.module';
import { MerchandisingController } from './merchandising.controller';
import { MERCHANDISING_STORE, MerchandisingService } from './merchandising.service';
import { InMemoryMerchandisingStore, MerchandisingStore } from './merchandising.store';
import { PgMerchandisingStore } from './merchandising.sql-store';

@Module({
  imports: [CatalogModule],
  controllers: [MerchandisingController],
  providers: [
    MerchandisingService,
    {
      provide: MERCHANDISING_STORE,
      useFactory: (db?: Db) =>
        selectStore<MerchandisingStore>(
          new InMemoryMerchandisingStore(),
          () => new PgMerchandisingStore(db!),
        ),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [MerchandisingService],
})
export class MerchandisingModule {}
