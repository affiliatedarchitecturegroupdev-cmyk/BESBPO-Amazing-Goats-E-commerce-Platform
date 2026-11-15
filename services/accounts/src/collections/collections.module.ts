import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { CollectionsController } from './collections.controller';
import { CollectionsService, COLLECTIONS_STORE } from './collections.service';
import { CollectionsStore, InMemoryCollectionsStore } from './collections.store';
import { PgCollectionsStore } from './collections.sql-store';

@Module({
  controllers: [CollectionsController],
  providers: [
    CollectionsService,
    {
      provide: COLLECTIONS_STORE,
      useFactory: (db?: Db) =>
        selectStore<CollectionsStore>(new InMemoryCollectionsStore(), () => new PgCollectionsStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [COLLECTIONS_STORE, CollectionsService],
})
export class CollectionsModule {}
