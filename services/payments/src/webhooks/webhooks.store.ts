/** A provider event as stored in `payments.provider_events`. */
export interface ProviderEventRecord {
  provider: string;
  eventId: string;
  signatureOk: boolean;
  payload: unknown;
  receivedAt: string;
  processedAt?: string;
}

/** Persistence boundary for provider events; the SQL adapter lands with the schema swap. */
export interface WebhookStore {
  /** Records an event, returning whether it is new. A duplicate is not stored twice. */
  record(event: ProviderEventRecord): { stored: boolean; event: ProviderEventRecord };
  list(): ProviderEventRecord[];
}

/**
 * In-memory provider-event store. Deduplicates on `(provider, eventId)`, which
 * mirrors the unique key on `payments.provider_events`, so a provider that
 * retries a delivery is processed once.
 */
export class InMemoryWebhookStore implements WebhookStore {
  private readonly byKey = new Map<string, ProviderEventRecord>();

  private key(provider: string, eventId: string): string {
    return `${provider}:${eventId}`;
  }

  record(event: ProviderEventRecord): { stored: boolean; event: ProviderEventRecord } {
    const key = this.key(event.provider, event.eventId);
    const existing = this.byKey.get(key);
    if (existing) return { stored: false, event: existing };
    this.byKey.set(key, event);
    return { stored: true, event };
  }

  list(): ProviderEventRecord[] {
    return [...this.byKey.values()];
  }
}
