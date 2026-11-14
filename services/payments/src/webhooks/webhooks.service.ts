import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { IntentsService } from '../intents/intents.service';
import type { WebhookInput } from '../providers/provider.interface';
import type { Provider } from '../routing/route-payment';
import { ProviderEventRecord, WebhookStore } from './webhooks.store';

export const WEBHOOK_STORE = Symbol('WEBHOOK_STORE');

export interface WebhookResult {
  received: true;
  duplicate: boolean;
  eventId: string;
}

@Injectable()
export class WebhooksService {
  constructor(
    @Inject(WEBHOOK_STORE) private readonly store: WebhookStore,
    private readonly intents: IntentsService,
  ) {}

  list(): ProviderEventRecord[] {
    return this.store.list();
  }

  /**
   * Receives a provider webhook. The signature is verified by the adapter before
   * anything is stored; a bad signature is rejected with 400 and never recorded.
   * The event is then deduplicated on `(provider, eventId)` and, when new,
   * applied to the matching intent.
   */
  receive(provider: Provider, input: WebhookInput): WebhookResult {
    let handled: ReturnType<IntentsService['handleWebhook']>;
    try {
      handled = this.intents.handleWebhook(provider, input);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const { stored, event } = this.store.record({
      provider,
      eventId: handled.event.id,
      signatureOk: true,
      payload: handled.event,
      receivedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
    });
    return { received: true, duplicate: !stored, eventId: event.eventId };
  }
}
