import { describe, expect, it } from 'vitest';
import type { MySubscription } from '@ag/api-client';
import { cadenceLabel, nextRunLabel, sastDay, sortForAccount, subscriptionState } from './subscriptions';

function subscription(overrides: Partial<MySubscription> = {}): MySubscription {
  return {
    id: 'sub_1',
    cadence: 'weekly',
    nextRunAt: '2026-11-29T15:00:00.000Z',
    paused: false,
    skipped: [],
    ...overrides,
  };
}

describe('cadenceLabel', () => {
  it('names each cadence in words', () => {
    expect(cadenceLabel('weekly')).toBe('Every week');
    expect(cadenceLabel('fortnightly')).toBe('Every two weeks');
    expect(cadenceLabel('monthly')).toBe('Every month');
  });
});

describe('sastDay', () => {
  it('renders a late-evening UTC instant as the next South African day', () => {
    // 22:30 UTC on the 28th is 00:30 on the 29th in Durban; the delivery day the
    // customer chose is the 29th, so the UTC date would name the wrong day.
    expect(sastDay('2026-11-28T22:30:00.000Z')).toBe('2026-11-29');
  });

  it('keeps a mid-morning instant on its own day', () => {
    expect(sastDay('2026-11-29T08:00:00.000Z')).toBe('2026-11-29');
  });

  it('returns an empty string for an unparseable instant', () => {
    expect(sastDay('not-a-date')).toBe('');
  });
});

describe('nextRunLabel', () => {
  it('says "Runs today" when the next run is today in SAST', () => {
    expect(nextRunLabel(subscription(), '2026-11-29')).toBe('Runs today');
  });

  it('names the next day otherwise', () => {
    expect(nextRunLabel(subscription(), '2026-11-27')).toBe('Next run 2026-11-29');
  });

  it('states the pause and still shows the date, because pausing is not skipping', () => {
    expect(nextRunLabel(subscription({ paused: true }), '2026-11-29')).toBe(
      'Paused · next run 2026-11-29 when resumed',
    );
  });

  it('handles a missing date without inventing one', () => {
    expect(nextRunLabel(subscription({ nextRunAt: '' }))).toBe('No date set');
  });
});

describe('subscriptionState', () => {
  it('maps paused to a word a shopper reads', () => {
    expect(subscriptionState(subscription())).toBe('Active');
    expect(subscriptionState(subscription({ paused: true }))).toBe('Paused');
  });
});

describe('sortForAccount', () => {
  it('puts running subscriptions above paused ones', () => {
    const rows = sortForAccount([
      subscription({ id: 'paused-soon', paused: true, nextRunAt: '2026-11-20T00:00:00.000Z' }),
      subscription({ id: 'running-later', paused: false, nextRunAt: '2026-12-01T00:00:00.000Z' }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['running-later', 'paused-soon']);
  });

  it('orders running subscriptions by next run', () => {
    const rows = sortForAccount([
      subscription({ id: 'b', nextRunAt: '2026-12-05T00:00:00.000Z' }),
      subscription({ id: 'a', nextRunAt: '2026-11-30T00:00:00.000Z' }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('does not mutate the array it was given', () => {
    const input = [
      subscription({ id: 'b', nextRunAt: '2026-12-05T00:00:00.000Z' }),
      subscription({ id: 'a', nextRunAt: '2026-11-30T00:00:00.000Z' }),
    ];
    sortForAccount(input);
    expect(input.map((r) => r.id)).toEqual(['b', 'a']);
  });
});
