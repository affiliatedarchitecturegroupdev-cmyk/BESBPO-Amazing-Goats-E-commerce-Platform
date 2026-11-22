import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_RETENTION_DAYS,
  InMemoryConversationStore,
  buildTurn,
  isExpired,
  retentionHorizon,
} from './conversation.store';

const input = {
  conversationId: 'c1',
  question: 'what is the price of the lamb box',
  answer: 'R209.00',
  refused: false,
  factIds: ['product:AG-LM-002'],
  model: 'ranking',
};

describe('buildTurn', () => {
  it('redacts the question on the way in', () => {
    const turn = buildTurn({ ...input, question: 'mail thandi@example.co.za about lamb' });
    expect(turn.question).toBe('mail [email] about lamb');
  });

  it('keeps the fact ids, so the answer can be reconstructed', () => {
    expect(buildTurn(input).factIds).toEqual(['product:AG-LM-002']);
  });

  it('copies the fact ids rather than sharing the caller array', () => {
    const ids = ['product:AG-LM-002'];
    const turn = buildTurn({ ...input, factIds: ids });
    ids.push('product:OTHER');
    expect(turn.factIds).toEqual(['product:AG-LM-002']);
  });

  it('gives each turn a distinct id', () => {
    expect(buildTurn(input).id).not.toBe(buildTurn(input).id);
  });

  it('stamps an ISO time', () => {
    const turn = buildTurn({ ...input, at: new Date('2026-11-14T08:00:00.000Z') });
    expect(turn.at).toBe('2026-11-14T08:00:00.000Z');
  });

  it('omits the user id for an anonymous turn', () => {
    expect(buildTurn(input).userId).toBeUndefined();
  });
});

describe('InMemoryConversationStore', () => {
  it('appends and lists by conversation', async () => {
    const store = new InMemoryConversationStore();
    await store.append(buildTurn(input));
    await store.append(buildTurn({ ...input, conversationId: 'c2' }));
    expect(await store.list('c1')).toHaveLength(1);
    expect(await store.list('c2')).toHaveLength(1);
  });

  it('returns nothing for a conversation it has not seen', async () => {
    expect(await new InMemoryConversationStore().list('nope')).toEqual([]);
  });

  it('keeps turns in the order they were asked', async () => {
    const store = new InMemoryConversationStore();
    await store.append(buildTurn({ ...input, question: 'first' }));
    await store.append(buildTurn({ ...input, question: 'second' }));
    expect((await store.list('c1')).map((t) => t.question)).toEqual(['first', 'second']);
  });
});

describe('retention', () => {
  const now = new Date('2026-11-14T08:00:00.000Z');
  const turnAt = (iso: string) => buildTurn({ ...input, at: new Date(iso) });

  it('expires a turn older than the retention period', () => {
    expect(isExpired(turnAt('2026-08-01T00:00:00.000Z'), now)).toBe(true);
  });

  it('keeps a turn inside the retention period', () => {
    expect(isExpired(turnAt('2026-11-01T00:00:00.000Z'), now)).toBe(false);
  });

  it('keeps a turn exactly on the boundary, since the horizon is exclusive', () => {
    const horizon = retentionHorizon(now).toISOString();
    expect(isExpired(turnAt(horizon), now)).toBe(false);
  });

  it('measures the horizon from the named limit, not a magic number', () => {
    const horizon = retentionHorizon(now);
    const days = (now.getTime() - horizon.getTime()) / 86_400_000;
    expect(days).toBe(CONVERSATION_RETENTION_DAYS);
  });

  it('purges only the expired turns and reports how many went', async () => {
    const store = new InMemoryConversationStore();
    await store.append(turnAt('2026-08-01T00:00:00.000Z'));
    await store.append(turnAt('2026-11-01T00:00:00.000Z'));
    await expect(store.purgeExpired(now)).resolves.toBe(1);
    expect(await store.list('c1')).toHaveLength(1);
  });

  it('purges nothing when every turn is current', async () => {
    const store = new InMemoryConversationStore();
    await store.append(turnAt('2026-11-13T00:00:00.000Z'));
    await expect(store.purgeExpired(now)).resolves.toBe(0);
  });
});
