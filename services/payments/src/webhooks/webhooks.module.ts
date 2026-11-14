import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService, WEBHOOK_STORE } from './webhooks.service';
import { InMemoryWebhookStore } from './webhooks.store';
import { IntentsModule } from '../intents/intents.module';

@Module({
  imports: [IntentsModule],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    { provide: WEBHOOK_STORE, useFactory: () => new InMemoryWebhookStore() },
  ],
})
export class WebhooksModule {}
