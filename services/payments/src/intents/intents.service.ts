import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { routePayment } from '../routing/route-payment';
import type { Method, Provider } from '../routing/route-payment';
import { withFallback } from '../routing/provider-fallback';
import { ProvidersService } from '../providers/providers.service';
import {
  IdempotencyStore,
  PaymentIntent,
  applyStatus,
  canTransition,
  createIntent,
} from '../providers/payment-intent';
import type { PaymentResult, WebhookEvent, WebhookInput } from '../providers/provider.interface';
import { IntentStore } from './intents.store';

export const INTENT_STORE = Symbol('INTENT_STORE');

export interface CreateIntentInput {
  idempotencyKey: string;
  method: Method;
  amountIncVatCents: number;
  orderId?: string;
  invoiceId?: string;
  reference?: string;
  returnUrl?: string;
  notifyUrl?: string;
}

@Injectable()
export class IntentsService {
  constructor(
    @Inject(INTENT_STORE) private readonly store: IntentStore,
    private readonly providers: ProvidersService,
  ) {}

  list(): PaymentIntent[] {
    return this.store.list().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): PaymentIntent {
    const intent = this.store.getById(id);
    if (!intent) throw new NotFoundException(`unknown payment intent ${id}`);
    return intent;
  }

  /**
   * Idempotent create-and-charge. The intent is created (or the existing one
   * returned) from the idempotency key, then routed to the first configured
   * provider for the method, falling back to the next routed provider when one
   * fails. A repeat call with the same key returns the stored intent without
   * charging again.
   */
  async create(input: CreateIntentInput): Promise<PaymentIntent> {
    const idempotency: IdempotencyStore = {
      get: (key) => this.store.getByIdempotencyKey(key),
      put: (_key, intent) => {
        this.store.save(intent);
      },
    };
    const intent = createIntent(input, idempotency);
    if (intent.providerRef) return intent;

    const candidates = routePayment({
      method: input.method,
      amountCents: intent.amountIncVatCents,
    }).filter((candidate) => this.providers.has(candidate));
    if (candidates.length === 0) {
      throw new NotFoundException(`no configured provider for ${input.method}`);
    }

    // Each attempt is idempotent at the provider (same key, same amount), so a
    // fallback after a failed primary cannot charge twice.
    const outcome = await withFallback(candidates, (providerId) =>
      this.providers.get(providerId).createPayment({
        intentId: intent.id,
        amountCents: intent.amountIncVatCents,
        currency: 'ZAR',
        method: input.method,
        reference: input.reference ?? intent.id,
        idempotencyKey: intent.idempotencyKey,
        returnUrl: input.returnUrl,
        notifyUrl: input.notifyUrl,
      }),
    ).catch((error) => {
      if (error instanceof Error && error.name === 'AllProvidersFailedError') {
        throw new ServiceUnavailableException(error.message);
      }
      throw error;
    });

    const result: PaymentResult = outcome.result;
    const next: PaymentIntent = {
      ...applyStatus(intent, result.status),
      provider: outcome.provider,
      providerRef: result.providerRef,
    };
    return this.store.save(next);
  }

  /**
   * Verifies a provider webhook and applies its status to the matching intent.
   * An unknown reference is accepted (the event may arrive before the intent is
   * stored) but not applied. An out-of-order or illegal transition is ignored
   * rather than failing the request, so the provider is not asked to retry.
   */
  handleWebhook(
    providerId: Provider,
    input: WebhookInput,
  ): { event: WebhookEvent; intent?: PaymentIntent } {
    const provider = this.providers.get(providerId);
    const event = provider.verifyWebhook(input);

    const intent = this.store.findByProviderRef(event.providerRef);
    if (!intent) return { event };
    if (intent.status !== event.status && !canTransition(intent.status, event.status)) {
      return { event, intent };
    }
    return { event, intent: this.store.save(applyStatus(intent, event.status)) };
  }
}
