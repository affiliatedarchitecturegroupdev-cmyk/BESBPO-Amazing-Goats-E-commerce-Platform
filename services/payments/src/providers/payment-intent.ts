import { createHash } from 'node:crypto';
import type { Method } from '../routing/route-payment';

/** Status of a payment intent. `created` until the customer starts paying. */
export type IntentStatus = 'created' | 'pending' | 'succeeded' | 'failed' | 'cancelled';

export interface PaymentIntent {
  id: string;
  orderId?: string;
  invoiceId?: string;
  method: Method;
  amountIncVatCents: number;
  currency: 'ZAR';
  provider?: string;
  providerRef?: string;
  status: IntentStatus;
  idempotencyKey: string;
  createdAt: string;
}

/** Statuses from which no further transition is possible. */
const TERMINAL: readonly IntentStatus[] = ['succeeded', 'failed', 'cancelled'];

export function isTerminal(status: IntentStatus): boolean {
  return TERMINAL.includes(status);
}

/** Legal intent transitions. A terminal status never changes. */
const TRANSITIONS: Record<IntentStatus, readonly IntentStatus[]> = {
  created: ['pending', 'succeeded', 'failed', 'cancelled'],
  pending: ['succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: IntentStatus, to: IntentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Applies a status change, rejecting an illegal move. Idempotent: a repeat of
 * the current status is accepted and returns the same intent unchanged, so a
 * provider that sends the same webhook twice is harmless.
 */
export function applyStatus(
  intent: PaymentIntent,
  to: IntentStatus,
  at: Date = new Date(),
): PaymentIntent {
  if (intent.status === to) return intent;
  if (!canTransition(intent.status, to)) {
    throw new Error(`cannot move intent ${intent.id} from ${intent.status} to ${to}`);
  }
  void at;
  return { ...intent, status: to };
}

export interface IdempotencyStore {
  get(key: string): PaymentIntent | undefined;
  put(key: string, intent: PaymentIntent): void;
}

/** In-memory idempotency index; the SQL adapter uses the unique key on `payments.intents`. */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly byKey = new Map<string, PaymentIntent>();

  get(key: string): PaymentIntent | undefined {
    return this.byKey.get(key);
  }

  put(key: string, intent: PaymentIntent): void {
    this.byKey.set(key, intent);
  }
}

/**
 * Idempotent intent creation. Given the same idempotency key the existing intent
 * is returned, so a retried request (a double-click, a network retry) creates
 * one intent and, at most, one charge. A key reused with a different amount is a
 * caller error and throws, because silently returning the first intent would
 * hide a real mismatch.
 */
export function createIntent(
  input: {
    idempotencyKey: string;
    method: Method;
    amountIncVatCents: number;
    orderId?: string;
    invoiceId?: string;
    currency?: 'ZAR';
    now?: Date;
  },
  store: IdempotencyStore,
): PaymentIntent {
  if (!input.idempotencyKey) throw new Error('an idempotency key is required');
  if (!Number.isInteger(input.amountIncVatCents) || input.amountIncVatCents <= 0) {
    throw new Error('amount must be a positive integer number of cents');
  }

  const existing = store.get(input.idempotencyKey);
  if (existing) {
    if (existing.amountIncVatCents !== input.amountIncVatCents) {
      throw new Error(`idempotency key ${input.idempotencyKey} was used with a different amount`);
    }
    return existing;
  }

  const now = input.now ?? new Date();
  const intent: PaymentIntent = {
    id: `pi_${createHash('sha256').update(input.idempotencyKey).digest('hex').slice(0, 24)}`,
    orderId: input.orderId,
    invoiceId: input.invoiceId,
    method: input.method,
    amountIncVatCents: input.amountIncVatCents,
    currency: input.currency ?? 'ZAR',
    status: 'created',
    idempotencyKey: input.idempotencyKey,
    createdAt: now.toISOString(),
  };
  store.put(input.idempotencyKey, intent);
  return intent;
}
