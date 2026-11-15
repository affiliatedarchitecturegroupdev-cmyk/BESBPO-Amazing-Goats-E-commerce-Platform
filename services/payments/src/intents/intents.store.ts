import { PaymentIntent } from '../providers/payment-intent';

/** Persistence boundary for intents; the SQL adapter is over `payments.intents`. */
export interface IntentStore {
  getById(id: string): Promise<PaymentIntent | undefined>;
  getByIdempotencyKey(key: string): Promise<PaymentIntent | undefined>;
  findByProviderRef(providerRef: string): Promise<PaymentIntent | undefined>;
  list(): Promise<PaymentIntent[]>;
  save(intent: PaymentIntent): Promise<PaymentIntent>;
}

/** In-memory intent store used by tests and local runs; the default driver. */
export class InMemoryIntentStore implements IntentStore {
  private readonly byId = new Map<string, PaymentIntent>();
  private readonly byKey = new Map<string, PaymentIntent>();
  private readonly byRef = new Map<string, PaymentIntent>();

  async getById(id: string): Promise<PaymentIntent | undefined> {
    return this.byId.get(id);
  }

  async getByIdempotencyKey(key: string): Promise<PaymentIntent | undefined> {
    return this.byKey.get(key);
  }

  async findByProviderRef(providerRef: string): Promise<PaymentIntent | undefined> {
    return this.byRef.get(providerRef);
  }

  async list(): Promise<PaymentIntent[]> {
    return [...this.byId.values()];
  }

  async save(intent: PaymentIntent): Promise<PaymentIntent> {
    this.byId.set(intent.id, intent);
    this.byKey.set(intent.idempotencyKey, intent);
    if (intent.providerRef) this.byRef.set(intent.providerRef, intent);
    return intent;
  }
}
