import { PaymentIntent } from '../providers/payment-intent';

/** Persistence boundary for intents; the SQL adapter lands with the payments schema swap. */
export interface IntentStore {
  getById(id: string): PaymentIntent | undefined;
  getByIdempotencyKey(key: string): PaymentIntent | undefined;
  findByProviderRef(providerRef: string): PaymentIntent | undefined;
  list(): PaymentIntent[];
  save(intent: PaymentIntent): PaymentIntent;
}

/** In-memory intent store used by tests and local runs until the SQL adapter is wired. */
export class InMemoryIntentStore implements IntentStore {
  private readonly byId = new Map<string, PaymentIntent>();
  private readonly byKey = new Map<string, PaymentIntent>();
  private readonly byRef = new Map<string, PaymentIntent>();

  getById(id: string): PaymentIntent | undefined {
    return this.byId.get(id);
  }

  getByIdempotencyKey(key: string): PaymentIntent | undefined {
    return this.byKey.get(key);
  }

  findByProviderRef(providerRef: string): PaymentIntent | undefined {
    return this.byRef.get(providerRef);
  }

  list(): PaymentIntent[] {
    return [...this.byId.values()];
  }

  save(intent: PaymentIntent): PaymentIntent {
    this.byId.set(intent.id, intent);
    this.byKey.set(intent.idempotencyKey, intent);
    if (intent.providerRef) this.byRef.set(intent.providerRef, intent);
    return intent;
  }
}
