import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService, WEBHOOK_STORE } from './webhooks.service';
import { InMemoryWebhookStore, WebhookStore } from './webhooks.store';
import { PgWebhookStore } from './webhooks.sql-store';
import { AG_DB } from '@ag/nest-db';
import { IntentsModule } from '../intents/intents.module';

@Module({
  imports: [IntentsModule],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    {
      provide: WEBHOOK_STORE,
      useFactory: (db?: Db) =>
        selectStore<WebhookStore>(new InMemoryWebhookStore(), () => new PgWebhookStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
})
export class WebhooksModule {}
