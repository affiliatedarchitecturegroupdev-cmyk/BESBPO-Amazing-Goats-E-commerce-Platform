import { describe, it, expect } from 'vitest';
import {
  InMemoryCampaignStore,
  canStartSend,
  markSent,
  markSending,
  nextBatch,
  statusAfterTick,
  type Campaign,
} from './campaign';
import { confirm, newSubscriber, unsubscribe } from './subscriber';

const at = new Date('2026-03-01T08:00:00Z');

const campaign: Campaign = {
  id: 'camp_1',
  subject: 'This week at the farm',
  bodyMd: 'Hello',
  status: 'draft',
  createdBy: 'staff_1',
  createdAt: at.toISOString(),
  updatedAt: at.toISOString(),
};

function confirmed(email: string, when = at) {
  return confirm(newSubscriber({ email, at: when }), at);
}

describe('nextBatch', () => {
  const list = [
    confirmed('a@b.co', new Date('2026-03-01T08:00:00Z')),
    confirmed('c@d.co', new Date('2026-03-01T09:00:00Z')),
    confirmed('e@f.co', new Date('2026-03-01T10:00:00Z')),
  ];

  it('takes at most batchSize recipients', () => {
    expect(nextBatch(campaign, list, [], 2).map((s) => s.email)).toEqual(['a@b.co', 'c@d.co']);
  });

  it('skips recipients already decided, so a resume does not double-send', () => {
    expect(nextBatch(campaign, list, [list[0].id, list[1].id], 10).map((s) => s.email)).toEqual([
      'e@f.co',
    ]);
  });

  it('never includes a subscriber who is not confirmed', () => {
    const mixed = [...list, unsubscribe(newSubscriber({ email: 'g@h.co', at }), at)];
    expect(nextBatch(campaign, mixed, [], 10).map((s) => s.email)).not.toContain('g@h.co');
  });

  it('returns nothing when the batch size is zero or negative', () => {
    expect(nextBatch(campaign, list, [], 0)).toEqual([]);
    expect(nextBatch(campaign, list, [], -5)).toEqual([]);
  });

  it('returns nothing when every recipient is decided', () => {
    expect(nextBatch(campaign, list, list.map((s) => s.id), 10)).toEqual([]);
  });
});

describe('canStartSend', () => {
  it('may start a draft', () => {
    expect(canStartSend(campaign, at)).toBe(true);
  });

  it('may resume a campaign that is already sending', () => {
    expect(canStartSend(markSending(campaign, at), at)).toBe(true);
  });

  it('may start a scheduled campaign whose time has come', () => {
    const scheduled: Campaign = {
      ...campaign,
      status: 'scheduled',
      scheduledFor: '2026-03-01T07:00:00Z',
    };
    expect(canStartSend(scheduled, at)).toBe(true);
  });

  it('may not start a scheduled campaign early', () => {
    const scheduled: Campaign = {
      ...campaign,
      status: 'scheduled',
      scheduledFor: '2026-03-01T09:00:00Z',
    };
    expect(canStartSend(scheduled, at)).toBe(false);
  });

  it('may not re-send a campaign that is already sent or cancelled', () => {
    expect(canStartSend(markSent(campaign, at), at)).toBe(false);
    expect(canStartSend({ ...campaign, status: 'cancelled' }, at)).toBe(false);
  });
});

describe('statusAfterTick', () => {
  it('stays sending while recipients remain', () => {
    expect(statusAfterTick(3, at)).toBe('sending');
  });

  it('becomes sent only when the list is exhausted', () => {
    expect(statusAfterTick(0, at)).toBe('sent');
  });
});

describe('InMemoryCampaignStore', () => {
  it('does not create a second row for the same recipient, so a replay is safe', async () => {
    const store = new InMemoryCampaignStore();
    const send = {
      campaignId: 'camp_1',
      subscriberId: 'sub_1',
      outcome: 'sent' as const,
      reason: 'opted_in',
      at: at.toISOString(),
    };
    await store.recordSend(send);
    await store.recordSend({ ...send, outcome: 'failed' });
    expect(await store.sends('camp_1')).toHaveLength(1);
    expect((await store.sends('camp_1'))[0].outcome).toBe('sent');
  });

  it('reports the recipients already decided for one campaign only', async () => {
    const store = new InMemoryCampaignStore();
    await store.recordSend({
      campaignId: 'camp_1',
      subscriberId: 'sub_1',
      outcome: 'sent',
      reason: 'opted_in',
      at: at.toISOString(),
    });
    expect(await store.sentSubscriberIds('camp_1')).toEqual(['sub_1']);
    expect(await store.sentSubscriberIds('camp_2')).toEqual([]);
  });
});
