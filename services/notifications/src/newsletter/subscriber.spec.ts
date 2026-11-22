import { describe, it, expect } from 'vitest';
import {
  InMemorySubscriberStore,
  confirm,
  hashIp,
  looksLikeEmail,
  mayReceiveCampaign,
  newSubscriber,
  normaliseEmail,
  planSubscribe,
  unsubscribe,
} from './subscriber';

const at = new Date('2026-03-01T08:00:00Z');

describe('normaliseEmail', () => {
  it('lowercases and trims, so a capital is not a different person', () => {
    expect(normaliseEmail('  Thabo@Example.COM ')).toBe('thabo@example.com');
  });
});

describe('looksLikeEmail', () => {
  it('accepts a normal address', () => {
    expect(looksLikeEmail('thabo@example.co.za')).toBe(true);
  });

  it('rejects an address with no domain dot, no at, or spaces', () => {
    expect(looksLikeEmail('thabo@localhost')).toBe(false);
    expect(looksLikeEmail('thabo.example.com')).toBe(false);
    expect(looksLikeEmail('thabo @example.com')).toBe(false);
    expect(looksLikeEmail('')).toBe(false);
  });
});

describe('hashIp', () => {
  it('never returns the raw address', () => {
    const hashed = hashIp('196.25.1.1', 'salt');
    expect(hashed).not.toContain('196.25');
    expect(hashed).toHaveLength(64);
  });

  it('is stable for the same salt and address, and differs across salts', () => {
    expect(hashIp('196.25.1.1', 'salt')).toBe(hashIp('196.25.1.1', 'salt'));
    expect(hashIp('196.25.1.1', 'salt')).not.toBe(hashIp('196.25.1.1', 'other'));
  });
});

describe('newSubscriber', () => {
  it('starts pending and mints two different tokens', () => {
    const subscriber = newSubscriber({ email: 'Thabo@Example.com', at });
    expect(subscriber.status).toBe('pending');
    expect(subscriber.email).toBe('thabo@example.com');
    expect(subscriber.confirmToken).not.toBe(subscriber.unsubscribeToken);
    expect(subscriber.confirmToken.length).toBeGreaterThan(20);
  });

  it('does not set confirmed_at before the click', () => {
    expect(newSubscriber({ email: 'a@b.co', at }).confirmedAt).toBeUndefined();
  });
});

describe('planSubscribe', () => {
  const base = newSubscriber({ email: 'a@b.co', at });

  it('creates when there is no row', () => {
    expect(planSubscribe(undefined)).toEqual({ kind: 'create' });
  });

  it('resends the confirmation for a pending row, in case it was lost', () => {
    expect(planSubscribe(base)).toEqual({ kind: 'resend_confirmation' });
  });

  it('does nothing for an already confirmed row', () => {
    expect(planSubscribe(confirm(base, at))).toEqual({ kind: 'already_confirmed' });
  });

  it('reactivates an unsubscribed row, but still requires a click', () => {
    expect(planSubscribe(unsubscribe(base, at))).toEqual({ kind: 'reactivate' });
  });

  it('does not revive a bounced or complained address automatically', () => {
    expect(planSubscribe({ ...base, status: 'bounced' })).toEqual({
      kind: 'blocked',
      reason: 'bounced',
    });
    expect(planSubscribe({ ...base, status: 'complained' })).toEqual({
      kind: 'blocked',
      reason: 'complained',
    });
  });
});

describe('confirm', () => {
  it('moves pending to confirmed and stamps the time', () => {
    const confirmed = confirm(newSubscriber({ email: 'a@b.co', at }), at);
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.confirmedAt).toBe(at.toISOString());
  });

  it('is idempotent: a second click changes nothing', () => {
    const once = confirm(newSubscriber({ email: 'a@b.co', at }), at);
    expect(confirm(once, new Date('2026-04-01T00:00:00Z'))).toBe(once);
  });
});

describe('unsubscribe', () => {
  it('works from pending, so someone who never confirmed is still removed', () => {
    const removed = unsubscribe(newSubscriber({ email: 'a@b.co', at }), at);
    expect(removed.status).toBe('unsubscribed');
    expect(removed.unsubscribedAt).toBe(at.toISOString());
  });

  it('works from confirmed', () => {
    const confirmed = confirm(newSubscriber({ email: 'a@b.co', at }), at);
    expect(unsubscribe(confirmed, at).status).toBe('unsubscribed');
  });

  it('is idempotent', () => {
    const once = unsubscribe(newSubscriber({ email: 'a@b.co', at }), at);
    expect(unsubscribe(once, new Date('2026-04-01T00:00:00Z'))).toBe(once);
  });
});

describe('mayReceiveCampaign', () => {
  const base = newSubscriber({ email: 'a@b.co', at });

  it('allows only a confirmed subscriber', () => {
    expect(mayReceiveCampaign(confirm(base, at))).toBe(true);
    expect(mayReceiveCampaign(base)).toBe(false);
    expect(mayReceiveCampaign(unsubscribe(base, at))).toBe(false);
    expect(mayReceiveCampaign({ ...base, status: 'bounced' })).toBe(false);
  });
});

describe('InMemorySubscriberStore', () => {
  it('finds an address regardless of case', async () => {
    const store = new InMemorySubscriberStore([newSubscriber({ email: 'Thabo@Example.com', at })]);
    expect((await store.findByEmail('thabo@example.com'))?.email).toBe('thabo@example.com');
  });

  it('lists only confirmed subscribers, oldest first', async () => {
    const early = confirm(newSubscriber({ email: 'a@b.co', at }), at);
    const late = confirm(
      newSubscriber({ email: 'c@d.co', at: new Date('2026-03-02T08:00:00Z') }),
      at,
    );
    const pending = newSubscriber({ email: 'e@f.co', at });
    const store = new InMemorySubscriberStore([late, pending, early]);
    expect((await store.listConfirmed()).map((s) => s.email)).toEqual(['a@b.co', 'c@d.co']);
  });
});
