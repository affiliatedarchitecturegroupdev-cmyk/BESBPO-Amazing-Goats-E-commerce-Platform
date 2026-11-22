import { randomUUID } from 'node:crypto';
import { redactQuestion } from './assistant.rules';

/**
 * The conversation log (ADR 0013 s4 rule 6). A disputed answer must be
 * reconstructable, so each turn records the retrieved fact ids alongside the
 * question and the answer.
 *
 * It is POPIA personal data: the question is redacted before it is stored, the
 * log is readable only with `audit:read`, and it is never sent anywhere else.
 */
export interface ConversationTurn {
  id: string;
  conversationId: string;
  /** The caller's session subject, when signed in. */
  userId?: string;
  at: string;
  /** Redacted: an email, phone or long number in the question is replaced. */
  question: string;
  answer: string;
  refused: boolean;
  /** The retrieved fact ids, so the answer can be reconstructed. */
  factIds: string[];
  /** Which model selected the facts; `ranking` when none is configured. */
  model: string;
}

/**
 * How long a turn is kept, in days.
 *
 * The log exists to reconstruct a disputed answer, so it only needs to outlive a
 * complaint or a return window. POPIA s14 requires that personal data not be
 * kept longer than the purpose needs, so this is a named limit rather than an
 * open-ended table. `docs/02-access-control.md` sets no assistant-specific
 * period, so this follows the retention of the other personal-data logs.
 */
export const CONVERSATION_RETENTION_DAYS = 90;

/** The instant before which a turn is due for deletion. */
export function retentionHorizon(now: Date, days = CONVERSATION_RETENTION_DAYS): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** True when a turn is older than the retention period and must be purged. */
export function isExpired(turn: ConversationTurn, now: Date, days = CONVERSATION_RETENTION_DAYS): boolean {
  return new Date(turn.at).getTime() < retentionHorizon(now, days).getTime();
}

export interface ConversationStore {
  append(turn: ConversationTurn): Promise<void>;
  list(conversationId: string): Promise<ConversationTurn[]>;
  /** Delete turns past retention; returns how many were removed. */
  purgeExpired(now: Date, days?: number): Promise<number>;
}

export class InMemoryConversationStore implements ConversationStore {
  private turns: ConversationTurn[] = [];

  async append(turn: ConversationTurn): Promise<void> {
    this.turns.push(turn);
  }

  async list(conversationId: string): Promise<ConversationTurn[]> {
    return this.turns.filter((t) => t.conversationId === conversationId);
  }

  async purgeExpired(now: Date, days = CONVERSATION_RETENTION_DAYS): Promise<number> {
    const kept = this.turns.filter((t) => !isExpired(t, now, days));
    const removed = this.turns.length - kept.length;
    this.turns = kept;
    return removed;
  }
}

export interface LogTurnInput {
  conversationId: string;
  question: string;
  answer: string;
  refused: boolean;
  factIds: string[];
  model: string;
  userId?: string;
  at?: Date;
}

/** Build a turn for storage, redacting the question and stamping the time. */
export function buildTurn(input: LogTurnInput): ConversationTurn {
  return {
    id: randomUUID(),
    conversationId: input.conversationId,
    ...(input.userId ? { userId: input.userId } : {}),
    at: (input.at ?? new Date()).toISOString(),
    question: redactQuestion(input.question),
    answer: input.answer,
    refused: input.refused,
    factIds: [...input.factIds],
    model: input.model,
  };
}
