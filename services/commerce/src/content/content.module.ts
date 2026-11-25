import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { ContentController } from './content.controller';
import { ContentService, CONTENT_STORE } from './content.service';
import { InMemoryContentStore, type ContentStore } from './content.store';
import { PgContentStore } from './content.sql-store';

/**
 * Content: blog posts, recipes and buying guides behind one model (ADR 0013 s1).
 * The store switches on `STORE_DRIVER` like every other commerce module, so a
 * deployment with a database persists content in `catalog.content` and
 * `catalog.content_recipes` (migrations 0023, 0024) while tests run in memory.
 */
@Module({
  controllers: [ContentController],
  providers: [
    ContentService,
    {
      provide: CONTENT_STORE,
      useFactory: (db?: Db) =>
        selectStore<ContentStore>(new InMemoryContentStore(), () => new PgContentStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [ContentService],
})
export class ContentModule {}
