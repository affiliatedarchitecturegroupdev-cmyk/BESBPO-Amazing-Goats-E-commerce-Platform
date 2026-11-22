import { createHash, randomBytes } from 'node:crypto';

/**
 * The newsletter list. This is deliberately **not** `notifications.consent`:
 * consent to receive an order confirmation is not consent to receive a
 * newsletter, and merging them would silently turn every customer who bought
 * something into a marketing list (POPIA s18, CPA s11 — ADR 0013 s3).
 *
 * A subscriber reaches `confirmed` only by clicking a link sent to the address
 * they typed, so the list holds people who asked for it.
 */

export type SubscriberStatus = 'pending' | 'confirmed' | 'unsubscribed' | 'bounced' | 'complained';

export interface Subscriber {
  id: string;
  email: string;
  status: SubscriberStatus;
  confirmToken: string;
  unsubscribeToken: string;
  confirmedAt?: string;
  unsubscribedAt?: string;
  source: string;
  ipHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriberStore {
  findByEmail(email: string): Promise<Subscriber | undefined>;
  findByConfirmToken(token: string): Promise<Subscriber | undefined>;
  findByUnsubscribeToken(token: string): Promise<Subscriber | undefined>;
  /** Every subscriber who may receive a campaign, in a stable order. */
  listConfirmed(): Promise<Subscriber[]>;
  create(subscriber: Subscriber): Promise<Subscriber>;
  update(subscriber: Subscriber): Promise<Subscriber>;
  get(id: string): Promise<Subscriber | undefined>;
}

/** In-memory store; the SQL adapter writes `notifications.subscribers`. */
export class InMemorySubscriberStore implements SubscriberStore {
  private readonly byId = new Map<string, Subscriber>();

  constructor(seed: Subscriber[] = []) {
    for (const subscriber of seed) this.byId.set(subscriber.id, subscriber);
  }

  async findByEmail(email: string): Promise<Subscriber | undefined> {
    const needle = email.trim().toLowerCase();
    return [...this.byId.values()].find((s) => s.email.toLowerCase() === needle);
  }

  async findByConfirmToken(token: string): Promise<Subscriber | undefined> {
    return [...this.byId.values()].find((s) => s.confirmToken === token);
  }

  async findByUnsubscribeToken(token: string): Promise<Subscriber | undefined> {
    return [...this.byId.values()].find((s) => s.unsubscribeToken === token);
  }

  async listConfirmed(): Promise<Subscriber[]> {
    return [...this.byId.values()]
      .filter((s) => s.status === 'confirmed')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async create(subscriber: Subscriber): Promise<Subscriber> {
    this.byId.set(subscriber.id, subscriber);
    return subscriber;
  }

  async update(subscriber: Subscriber): Promise<Subscriber> {
    this.byId.set(subscriber.id, subscriber);
    return subscriber;
  }

  async get(id: string): Promise<Subscriber | undefined> {
    return this.byId.get(id);
  }
}

/**
 * Normalises an address for storage and lookup. A trailing space or a capital
 * letter is not a different person, so both are removed before the address is
 * compared or stored.
 */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Whether an address is worth a confirmation email. Deliberately loose: a
 * stricter rule rejects addresses that are valid in practice. */
export function looksLikeEmail(email: string): boolean {
  return EMAIL.test(normaliseEmail(email));
}

/**
 * A salted hash of the caller's IP. The platform needs to recognise one source
 * flooding the list, not to know the address, so the raw IP is never stored
 * (POPIA minimisation).
 */
export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

export function newToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * What a subscribe request does, given the address and the row that already
 * exists for it. Returns the action rather than performing it, so the rule is
 * testable without a store.
 *
 * - no row          → create a `pending` row and send the confirmation
 * - `pending`       → resend the confirmation (the person may have lost it)
 * - `confirmed`     → nothing; they are already on the list
 * - `unsubscribed`  → back to `pending`, so opting in again is possible but still
 *                     requires the click
 * - `bounced` / `complained` → nothing automatic. A provider said this address
 *                     is bad; only an explicit re-subscribe should revive it.
 *
 * The caller always answers the same way whatever the branch, so the response
 * cannot be used to learn whether an address is on the list.
 */
export type SubscribeAction =
  | { kind: 'create' }
  | { kind: 'resend_confirmation' }
  | { kind: 'already_confirmed' }
  | { kind: 'reactivate' }
  | { kind: 'blocked'; reason: 'bounced' | 'complained' };

export function planSubscribe(existing: Subscriber | undefined): SubscribeAction {
  if (!existing) return { kind: 'create' };
  switch (existing.status) {
    case 'pending':
      return { kind: 'resend_confirmation' };
    case 'confirmed':
      return { kind: 'already_confirmed' };
    case 'unsubscribed':
      return { kind: 'reactivate' };
    case 'bounced':
    case 'complained':
      return { kind: 'blocked', reason: existing.status };
  }
}

/** A new `pending` subscriber. Tokens are minted here so a caller cannot reuse
 * one, and the confirmation token is never the unsubscribe token. */
export function newSubscriber(input: {
  email: string;
  source?: string;
  ipHash?: string;
  at?: Date;
}): Subscriber {
  const at = (input.at ?? new Date()).toISOString();
  return {
    id: `sub_${newToken().slice(0, 12)}`,
    email: normaliseEmail(input.email),
    status: 'pending',
    confirmToken: newToken(),
    unsubscribeToken: newToken(),
    source: input.source ?? 'unknown',
    ipHash: input.ipHash,
    createdAt: at,
    updatedAt: at,
  };
}

/**
 * Applies a confirmation click. Idempotent: confirming an already-confirmed
 * subscriber changes nothing, because an email client may prefetch the link and
 * a person may click it twice.
 */
export function confirm(subscriber: Subscriber, at: Date = new Date()): Subscriber {
  if (subscriber.status === 'confirmed') return subscriber;
  const when = at.toISOString();
  return { ...subscriber, status: 'confirmed', confirmedAt: when, updatedAt: when };
}

/**
 * Applies an unsubscribe. Idempotent, and it works from any state: someone who
 * never confirmed is still removed, and someone already unsubscribed stays so.
 * Unsubscribing must never depend on being on the list, because the person is
 * asking to be left alone.
 */
export function unsubscribe(subscriber: Subscriber, at: Date = new Date()): Subscriber {
  if (subscriber.status === 'unsubscribed') return subscriber;
  const when = at.toISOString();
  return { ...subscriber, status: 'unsubscribed', unsubscribedAt: when, updatedAt: when };
}

/** Whether a subscriber may receive a campaign. Only `confirmed` may. */
export function mayReceiveCampaign(subscriber: Subscriber): boolean {
  return subscriber.status === 'confirmed';
}
