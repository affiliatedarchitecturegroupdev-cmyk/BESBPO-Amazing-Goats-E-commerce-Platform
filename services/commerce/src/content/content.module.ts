import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService, CONTENT_STORE } from './content.service';
import { InMemoryContentStore } from './content.store';

/**
 * Content: blog posts, recipes and buying guides behind one model (ADR 0013 s1).
 * The store is in-memory behind the interface a SQL adapter implements
 * (`catalog.content`, `catalog.content_products`); the tables and policies exist
 * in migration 0023.
 */
@Module({
  controllers: [ContentController],
  providers: [
    ContentService,
    { provide: CONTENT_STORE, useFactory: () => new InMemoryContentStore() },
  ],
  exports: [ContentService],
})
export class ContentModule {}
