import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { IntentsController } from './intents.controller';
import { IntentsService, INTENT_STORE } from './intents.service';
import { InMemoryIntentStore, IntentStore } from './intents.store';
import { PgIntentStore } from './intents.sql-store';
import { AG_DB } from '@ag/nest-db';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [ProvidersModule],
  controllers: [IntentsController],
  providers: [
    IntentsService,
    {
      provide: INTENT_STORE,
      useFactory: (db?: Db) =>
        selectStore<IntentStore>(new InMemoryIntentStore(), () => new PgIntentStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [INTENT_STORE, IntentsService],
})
export class IntentsModule {}
