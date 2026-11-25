import { Module } from '@nestjs/common';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { DeliveryWebhookService } from './webhook.service';
import {
  DELIVERY_STORE,
  SUPPRESSION_STORE,
  WEBHOOK_SECRET,
  InMemoryDeliveryStore,
  InMemorySuppressionStore,
} from './delivery';

/**
 * Delivery state and the Resend webhook. The stores are in-memory, in the same
 * way the dispatch log and consent default to in-memory: delivery state has no
 * table yet, so the in-memory store is the only implementation and a restart
 * loses the outcomes, not the messages.
 */
@Module({
  controllers: [DeliveryController],
  providers: [
    DeliveryService,
    DeliveryWebhookService,
    { provide: DELIVERY_STORE, useFactory: () => new InMemoryDeliveryStore() },
    { provide: SUPPRESSION_STORE, useFactory: () => new InMemorySuppressionStore() },
    { provide: WEBHOOK_SECRET, useFactory: () => process.env.RESEND_WEBHOOK_SECRET },
  ],
  exports: [DeliveryService, SUPPRESSION_STORE],
})
export class DeliveryModule {}
