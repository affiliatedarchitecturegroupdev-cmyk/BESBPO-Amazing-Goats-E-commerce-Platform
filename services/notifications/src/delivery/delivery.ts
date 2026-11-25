import type { DeliveryEvent } from '../channels/resend';

export const DELIVERY_STORE = Symbol('DELIVERY_STORE');
export const SUPPRESSION_STORE = Symbol('SUPPRESSION_STORE');
export const WEBHOOK_SECRET = Symbol('WEBHOOK_SECRET');

/**
 * Delivery state for email. The dispatch log records what the platform *did*
 * (`sent` means the provider accepted the message); this records what the
 * provider then observed. The two are deliberately separate: until a webhook
 * arrives, `sent` does not mean delivered, and conflating them would hide a
 * bounced order confirmation.
 */
export interface DeliveryRecord {
  providerRef: string;
  event: DeliveryEvent;
  /** The recipient the provider reported, when it sent one. */
  address?: string;
  at: string;
}

export interface DeliveryStore {
  /** Record an outcome for a message, keyed by the provider's reference. */
  record(entry: DeliveryRecord): Promise<DeliveryRecord>;
  /** Every outcome for one message, oldest first. */
  forMessage(providerRef: string): Promise<DeliveryRecord[]>;
}

export class InMemoryDeliveryStore implements DeliveryStore {
  private readonly entries: DeliveryRecord[] = [];

  async record(entry: DeliveryRecord): Promise<DeliveryRecord> {
    this.entries.push(entry);
    return entry;
  }

  async forMessage(providerRef: string): Promise<DeliveryRecord[]> {
    return this.entries.filter((entry) => entry.providerRef === providerRef);
  }
}

export interface SuppressionEntry {
  address: string;
  reason: DeliveryEvent;
  at: string;
}

/**
 * Addresses that must not receive marketing. A hard bounce or a complaint means
 * the person does not want the mail, so every later campaign skips the address.
 *
 * Transactional mail is not suppressed: a customer still needs their order
 * confirmation even if a newsletter bounced, and refusing it would break the
 * order rather than respect a preference.
 */
export interface SuppressionStore {
  suppress(address: string, reason: DeliveryEvent): Promise<void>;
  isSuppressed(address: string): Promise<boolean>;
  list(): Promise<SuppressionEntry[]>;
}

export class InMemorySuppressionStore implements SuppressionStore {
  private readonly byAddress = new Map<string, Omit<SuppressionEntry, 'address'>>();

  async suppress(address: string, reason: DeliveryEvent): Promise<void> {
    this.byAddress.set(address.toLowerCase(), { reason, at: new Date().toISOString() });
  }

  async isSuppressed(address: string): Promise<boolean> {
    return this.byAddress.has(address.toLowerCase());
  }

  async list(): Promise<SuppressionEntry[]> {
    return [...this.byAddress.entries()].map(([address, value]) => ({ address, ...value }));
  }
}
