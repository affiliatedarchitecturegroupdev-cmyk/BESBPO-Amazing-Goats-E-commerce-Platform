import type { Channel } from '../templates/template';

/**
 * Consent for outbound messages. Transactional messages about an order a person
 * placed do not need marketing consent; anything promotional does, per POPIA
 * (see docs/07-compliance.md, "opt-in marketing"). Consent is per channel, so a
 * customer can allow email but not WhatsApp.
 */
export interface ConsentRecord {
  contactId: string;
  /** Channels the person has opted in to receive marketing on. */
  marketing: Channel[];
  /** Set when consent was captured; a null value means never asked. */
  consentAt?: string;
}

export interface ConsentStore {
  get(contactId: string): Promise<ConsentRecord | undefined>;
}

export type TemplateKind = 'transactional' | 'marketing';

export interface ConsentDecision {
  allowed: boolean;
  /** Why the decision was made, for the dispatch log and the audit trail. */
  reason: 'transactional' | 'opted_in' | 'no_consent' | 'unknown_contact';
}

/**
 * Whether a message may be sent. A transactional message is allowed without
 * consent (the person placed the order). A marketing message is allowed only
 * when the contact has opted in to that exact channel. An unknown contact is
 * never sent marketing, because consent cannot be assumed.
 */
export async function decideConsent(
  store: ConsentStore,
  input: { contactId: string; channel: Channel; kind: TemplateKind },
): Promise<ConsentDecision> {
  if (input.kind === 'transactional') return { allowed: true, reason: 'transactional' };

  const record = await store.get(input.contactId);
  if (!record) return { allowed: false, reason: 'unknown_contact' };
  if (record.marketing.includes(input.channel)) return { allowed: true, reason: 'opted_in' };
  return { allowed: false, reason: 'no_consent' };
}

/** In-memory consent store; the SQL adapter reads `notifications.consent`. */
export class InMemoryConsentStore implements ConsentStore {
  private readonly byId = new Map<string, ConsentRecord>();

  constructor(seed: ConsentRecord[] = []) {
    for (const record of seed) this.byId.set(record.contactId, record);
  }

  async get(contactId: string): Promise<ConsentRecord | undefined> {
    return this.byId.get(contactId);
  }

  set(record: ConsentRecord): void {
    this.byId.set(record.contactId, record);
  }
}
