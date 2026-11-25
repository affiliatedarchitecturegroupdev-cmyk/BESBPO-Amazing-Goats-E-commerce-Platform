import { describe, it, expect } from 'vitest';
import { NewsletterService } from './newsletter.service';
import { InMemorySubscriberStore, confirm, newSubscriber, unsubscribe } from './subscriber';
import { InMemoryCampaignStore, type Campaign } from './campaign';
import { DispatchService } from '../dispatch/dispatch.service';
import { InMemoryDispatchLog, type MessageTransport } from '../dispatch/dispatch';
import { InMemoryConsentStore } from '../consent/consent';

const at = new Date('2026-03-01T08:00:00Z');
const siteUrl = 'https://amazinggoats.store';

function recordingTransport() {
  const sent: { to: string; subject?: string; body: string }[] = [];
  const transport: MessageTransport = {
    channel: 'email',
    send: async (recipient, message) => {
      sent.push({ to: recipient.address, subject: message.subject, body: message.body });
      return { providerRef: `ref_${sent.length}` };
    },
  };
  return { transport, sent };
}

function setup(options: { transport?: MessageTransport[] } = {}) {
  const subscribers = new InMemorySubscriberStore();
  const campaigns = new InMemoryCampaignStore();
  const consent = new InMemoryConsentStore();
  const log = new InMemoryDispatchLog();
  const recorder = recordingTransport();
  const dispatch = new DispatchService(consent, log, options.transport ?? [recorder.transport]);
  const service = new NewsletterService(
    subscribers,
    campaigns,
    dispatch,
    'test-salt',
    siteUrl,
  );
  return { service, subscribers, campaigns, consent, log, dispatch, ...recorder };
}

const campaign: Campaign = {
  id: 'camp_1',
  subject: 'This week at the farm',
  bodyMd: 'Fresh goat this Friday.',
  status: 'draft',
  createdBy: 'staff_1',
  createdAt: at.toISOString(),
  updatedAt: at.toISOString(),
};

describe('subscribe — no enumeration', () => {
  it('answers identically for a new address, a confirmed one and a blocked one', async () => {
    const { service, subscribers } = setup();

    const fresh = await service.subscribe({ email: 'new@example.com' }, at);
    expect(fresh).toEqual({ status: 'accepted' });

    const confirmedRow = confirm(newSubscriber({ email: 'known@example.com', at }), at);
    await subscribers.create(confirmedRow);
    const known = await service.subscribe({ email: 'known@example.com' }, at);
    expect(known).toEqual(fresh);

    const bounced = { ...newSubscriber({ email: 'bad@example.com', at }), status: 'bounced' as const };
    await subscribers.create(bounced);
    const blocked = await service.subscribe({ email: 'bad@example.com' }, at);
    expect(blocked).toEqual(fresh);
  });

  it('answers identically for an invalid address, so a typo is not a signal', async () => {
    const { service } = setup();
    expect(await service.subscribe({ email: 'not-an-email' }, at)).toEqual({ status: 'accepted' });
  });

  it('creates a pending row and sends exactly one confirmation for a new address', async () => {
    const { service, subscribers, sent } = setup();
    await service.subscribe({ email: 'Thabo@Example.com', source: 'footer' }, at);

    const row = await subscribers.findByEmail('thabo@example.com');
    expect(row?.status).toBe('pending');
    expect(row?.source).toBe('footer');
    expect(sent).toHaveLength(1);
    expect(sent[0].to.includes('thabo@example.com') || sent[0].to === 'thabo@example.com').toBe(true);
    expect(sent[0].body).toContain('/notifications/subscribe/confirm?token=');
  });

  it('does not create a second row for the same address in different case', async () => {
    const { service, subscribers } = setup();
    await service.subscribe({ email: 'Thabo@Example.com' }, at);
    await service.subscribe({ email: 'thabo@example.com' }, at);
    expect((await subscribers.listConfirmed()).length).toBe(0);
    expect((await subscribers.findByEmail('thabo@example.com'))?.status).toBe('pending');
  });

  it('resends the confirmation to a pending address rather than adding a row', async () => {
    const { service, sent } = setup();
    await service.subscribe({ email: 'a@b.co' }, at);
    await service.subscribe({ email: 'a@b.co' }, at);
    expect(sent).toHaveLength(2);
    expect(sent.every((m) => m.body.includes('/notifications/subscribe/confirm?token='))).toBe(true);
  });

  it('sends nothing when the address is already confirmed', async () => {
    const { service, subscribers, sent } = setup();
    await subscribers.create(confirm(newSubscriber({ email: 'a@b.co', at }), at));
    await service.subscribe({ email: 'a@b.co' }, at);
    expect(sent).toHaveLength(0);
  });

  it('sends nothing to a bounced address, so a provider verdict is respected', async () => {
    const { service, subscribers, sent } = setup();
    await subscribers.create({ ...newSubscriber({ email: 'a@b.co', at }), status: 'bounced' });
    await service.subscribe({ email: 'a@b.co' }, at);
    expect(sent).toHaveLength(0);
  });

  it('stores a hash of the IP, never the address itself', async () => {
    const { service, subscribers } = setup();
    await service.subscribe({ email: 'a@b.co', ip: '196.25.1.1' }, at);
    const row = await subscribers.findByEmail('a@b.co');
    expect(row?.ipHash).toBeDefined();
    expect(row?.ipHash).not.toContain('196.25');
  });

  it('reactivates an unsubscribed address but still requires the click', async () => {
    const { service, subscribers, sent } = setup();
    const gone = unsubscribe(confirm(newSubscriber({ email: 'a@b.co', at }), at), at);
    await subscribers.create(gone);
    await service.subscribe({ email: 'a@b.co' }, at);
    expect((await subscribers.findByEmail('a@b.co'))?.status).toBe('pending');
    expect(sent).toHaveLength(1);
  });
});

describe('confirmToken', () => {
  it('moves pending to confirmed', async () => {
    const { service, subscribers } = setup();
    await service.subscribe({ email: 'a@b.co' }, at);
    const row = await subscribers.findByEmail('a@b.co');
    const confirmedRow = await service.confirmToken(row!.confirmToken, at);
    expect(confirmedRow?.status).toBe('confirmed');
  });

  it('is idempotent on a second click', async () => {
    const { service, subscribers } = setup();
    await service.subscribe({ email: 'a@b.co' }, at);
    const row = await subscribers.findByEmail('a@b.co');
    const first = await service.confirmToken(row!.confirmToken, at);
    const second = await service.confirmToken(row!.confirmToken, new Date('2026-04-01T00:00:00Z'));
    expect(second?.status).toBe('confirmed');
    expect(second?.confirmedAt).toBe(first?.confirmedAt);
  });

  it('returns undefined for an unknown token', async () => {
    const { service } = setup();
    expect(await service.confirmToken('nope', at)).toBeUndefined();
  });
});

describe('unsubscribeToken', () => {
  it('works with no session and no login, and is idempotent', async () => {
    const { service, subscribers } = setup();
    await service.subscribe({ email: 'a@b.co' }, at);
    const row = await subscribers.findByEmail('a@b.co');

    const first = await service.unsubscribeToken(row!.unsubscribeToken, at);
    expect(first?.status).toBe('unsubscribed');

    const second = await service.unsubscribeToken(row!.unsubscribeToken, new Date('2026-04-01T00:00:00Z'));
    expect(second?.status).toBe('unsubscribed');
    expect(second?.unsubscribedAt).toBe(first?.unsubscribedAt);
  });

  it('removes someone who never confirmed', async () => {
    const { service, subscribers } = setup();
    await service.subscribe({ email: 'a@b.co' }, at);
    const row = await subscribers.findByEmail('a@b.co');
    expect((await service.unsubscribeToken(row!.unsubscribeToken, at))?.status).toBe('unsubscribed');
  });

  it('returns undefined for an unknown token', async () => {
    const { service } = setup();
    expect(await service.unsubscribeToken('nope', at)).toBeUndefined();
  });
});

describe('tick — consent, pacing and bounce skip', () => {
  async function withConfirmed(count: number) {
    const ctx = setup();
    for (let i = 0; i < count; i += 1) {
      const subscriber = confirm(newSubscriber({ email: `s${i}@example.com`, at }), at);
      await ctx.subscribers.create(subscriber);
      // Opting in to marketing is what decideConsent checks; the subscriber row
      // alone is not enough, by design.
      ctx.consent.set({ contactId: subscriber.id, marketing: ['email'], consentAt: at.toISOString() });
    }
    await ctx.campaigns.create(campaign);
    return ctx;
  }

  it('sends to confirmed, opted-in subscribers and marks the campaign sent', async () => {
    const { service, campaigns, sent } = await withConfirmed(3);
    const result = await service.tick('camp_1', 10, at);
    expect(result.sent).toBe(3);
    expect(result.remaining).toBe(0);
    expect(result.status).toBe('sent');
    expect(sent).toHaveLength(3);
    expect((await campaigns.get('camp_1'))?.status).toBe('sent');
  });

  it('paces the send: one bounded tick does not exhaust the list', async () => {
    const { service, campaigns } = await withConfirmed(5);
    const first = await service.tick('camp_1', 2, at);
    expect(first.attempted).toBe(2);
    expect(first.sent).toBe(2);
    expect(first.remaining).toBe(3);
    expect(first.status).toBe('sending');
    expect((await campaigns.get('camp_1'))?.status).toBe('sending');
  });

  it('resumes without double-sending after a paced first tick', async () => {
    const { service, sent } = await withConfirmed(5);
    await service.tick('camp_1', 2, at);
    await service.tick('camp_1', 2, at);
    const final = await service.tick('camp_1', 2, at);

    expect(final.status).toBe('sent');
    expect(final.remaining).toBe(0);
    expect(sent).toHaveLength(5);
    expect(new Set(sent.map((m) => m.to)).size).toBe(5);
  });

  it('does not re-send to anyone when a tick is replayed after the campaign is sent', async () => {
    const { service, sent } = await withConfirmed(2);
    await service.tick('camp_1', 10, at);
    const replay = await service.tick('camp_1', 10, at);
    expect(replay.attempted).toBe(0);
    expect(sent).toHaveLength(2);
  });

  it('skips a pending subscriber: a row is not consent to marketing', async () => {
    const { service, subscribers, campaigns, consent, sent } = setup();
    const pending = newSubscriber({ email: 'pending@example.com', at });
    await subscribers.create(pending);
    // Even with marketing consent recorded, an unconfirmed address is not on the
    // list and must not receive a campaign.
    consent.set({ contactId: pending.id, marketing: ['email'] });
    await campaigns.create(campaign);

    const result = await service.tick('camp_1', 10, at);
    expect(result.attempted).toBe(0);
    expect(result.sent).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('suppresses a subscriber who never opted in, and records why', async () => {
    const { service, subscribers, campaigns, sent } = setup();
    // Confirmed on the list, but no marketing consent record.
    await subscribers.create(confirm(newSubscriber({ email: 'a@b.co', at }), at));
    await campaigns.create(campaign);

    const result = await service.tick('camp_1', 10, at);
    expect(result.sent).toBe(0);
    expect(result.suppressed).toBe(1);
    expect(sent).toHaveLength(0);
    const rows = await campaigns.sends('camp_1');
    expect(rows[0].outcome).toBe('suppressed');
    expect(rows[0].reason).toBe('unknown_contact');
  });

  it('skips a bounced subscriber in a later campaign', async () => {
    const { service, subscribers, campaigns, consent, sent } = setup();
    await subscribers.create({ ...confirm(newSubscriber({ email: 'bad@example.com', at }), at), status: 'bounced' });
    const good = confirm(newSubscriber({ email: 'good@example.com', at }), at);
    await subscribers.create(good);
    consent.set({ contactId: good.id, marketing: ['email'] });
    await campaigns.create(campaign);

    await service.tick('camp_1', 10, at);
    expect(sent.map((m) => m.to)).toEqual(['good@example.com']);
  });

  it('carries a working unsubscribe link in every marketing message', async () => {
    const { service, subscribers, campaigns, sent, consent } = setup();
    const subscriber = confirm(newSubscriber({ email: 'a@b.co', at }), at);
    await subscribers.create(subscriber);
    consent.set({ contactId: subscriber.id, marketing: ['email'] });
    await campaigns.create(campaign);

    await service.tick('camp_1', 10, at);
    expect(sent[0].body).toContain(`${siteUrl}/notifications/unsubscribe?token=${subscriber.unsubscribeToken}`);
  });

  it('refuses to send a cancelled campaign', async () => {
    const { service, campaigns, sent } = setup();
    await campaigns.create({ ...campaign, status: 'cancelled' });
    const result = await service.tick('camp_1', 10, at);
    expect(result.attempted).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('throws for an unknown campaign rather than reporting success', async () => {
    const { service } = setup();
    await expect(service.tick('nope', 10, at)).rejects.toThrow('no campaign');
  });
});
