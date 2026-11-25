import { Inject, Injectable } from '@nestjs/common';
import { DispatchService } from '../dispatch/dispatch.service';
import type { DispatchRecord } from '../dispatch/dispatch';
import {
  type Subscriber,
  type SubscriberStore,
  confirm,
  hashIp,
  looksLikeEmail,
  newSubscriber,
  normaliseEmail,
  planSubscribe,
  unsubscribe,
} from './subscriber';
import {
  type Campaign,
  type CampaignStore,
  DEFAULT_BATCH_SIZE,
  canStartSend,
  markSent,
  markSending,
  nextBatch,
} from './campaign';

export const SUBSCRIBER_STORE = Symbol('SUBSCRIBER_STORE');
export const CAMPAIGN_STORE = Symbol('CAMPAIGN_STORE');
export const IP_SALT = Symbol('IP_SALT');
export const SITE_URL = Symbol('SITE_URL');

export interface SubscribeInput {
  email: string;
  source?: string;
  /** The caller's IP, hashed before storage; never persisted raw. */
  ip?: string;
}

export interface SubscribeResult {
  /** Always the same shape, so the response cannot reveal whether the address
   * was already on the list. */
  status: 'accepted';
}

export interface TickResult {
  campaignId: string;
  attempted: number;
  sent: number;
  suppressed: number;
  failed: number;
  remaining: number;
  status: Campaign['status'];
}

/**
 * The newsletter. Consent is still the gate: a campaign send asks
 * `DispatchService`, which asks `decideConsent`, so a `pending` subscriber
 * receives nothing marketing even though a row exists for them.
 *
 * Subscribe never reveals whether an address is on the list. The caller gets the
 * same `accepted` answer for a new address, an address already confirmed, and a
 * blocked one; only the person holding the inbox learns the difference, from
 * whether the confirmation email arrives.
 */
@Injectable()
export class NewsletterService {
  constructor(
    @Inject(SUBSCRIBER_STORE) private readonly subscribers: SubscriberStore,
    @Inject(CAMPAIGN_STORE) private readonly campaigns: CampaignStore,
    private readonly dispatch: DispatchService,
    @Inject(IP_SALT) private readonly ipSalt: string,
    @Inject(SITE_URL) private readonly siteUrl: string,
  ) {}

  /** Records the intent to subscribe and sends the confirmation, if one is due. */
  async subscribe(input: SubscribeInput, at: Date = new Date()): Promise<SubscribeResult> {
    if (!looksLikeEmail(input.email)) return { status: 'accepted' };

    const existing = await this.subscribers.findByEmail(normaliseEmail(input.email));
    const action = planSubscribe(existing);

    switch (action.kind) {
      case 'create': {
        const subscriber = newSubscriber({
          email: input.email,
          source: input.source,
          ipHash: input.ip ? hashIp(input.ip, this.ipSalt) : undefined,
          at,
        });
        await this.subscribers.create(subscriber);
        await this.sendConfirmation(subscriber);
        return { status: 'accepted' };
      }
      case 'resend_confirmation':
        await this.sendConfirmation(existing as Subscriber);
        return { status: 'accepted' };
      case 'reactivate': {
        // A fresh row state, but the same person: back to pending, so the click
        // is still required. New tokens, because the old link may be in a
        // mailbox that is no longer theirs.
        const revived = {
          ...(existing as Subscriber),
          status: 'pending' as const,
          confirmToken: newSubscriber({ email: input.email }).confirmToken,
          confirmedAt: undefined,
          unsubscribedAt: undefined,
          updatedAt: at.toISOString(),
        };
        await this.subscribers.update(revived);
        await this.sendConfirmation(revived);
        return { status: 'accepted' };
      }
      case 'already_confirmed':
      case 'blocked':
        // Nothing to do, and nothing to say: the response is identical.
        return { status: 'accepted' };
    }
  }

  /** A confirmation click. Unknown token is a no-op, not an error, so a
   * scanner that walks links cannot map valid tokens by status code. */
  async confirmToken(token: string, at: Date = new Date()): Promise<Subscriber | undefined> {
    const subscriber = await this.subscribers.findByConfirmToken(token);
    if (!subscriber) return undefined;
    const updated = confirm(subscriber, at);
    if (updated === subscriber) return subscriber;
    return this.subscribers.update(updated);
  }

  /** An unsubscribe click. Works with no session and no login, and is
   * idempotent: a second click changes nothing and still reports success. */
  async unsubscribeToken(token: string, at: Date = new Date()): Promise<Subscriber | undefined> {
    const subscriber = await this.subscribers.findByUnsubscribeToken(token);
    if (!subscriber) return undefined;
    const updated = unsubscribe(subscriber, at);
    if (updated === subscriber) return subscriber;
    return this.subscribers.update(updated);
  }

  list(): Promise<Subscriber[]> {
    return this.subscribers.listConfirmed();
  }

  /**
   * One paced tick of a campaign. Bounded to `batchSize` recipients and
   * resumable: every recipient decided is recorded before the next is
   * attempted, so a crash mid-tick leaves the rest for the next tick instead of
   * re-sending the ones already done.
   */
  async tick(campaignId: string, batchSize: number = DEFAULT_BATCH_SIZE, at: Date = new Date()): Promise<TickResult> {
    const campaign = await this.campaigns.get(campaignId);
    if (!campaign) throw new Error(`no campaign ${campaignId}`);
    if (!canStartSend(campaign, at)) {
      return {
        campaignId,
        attempted: 0,
        sent: 0,
        suppressed: 0,
        failed: 0,
        remaining: 0,
        status: campaign.status,
      };
    }

    await this.campaigns.update(markSending(campaign, at));

    const confirmed = await this.subscribers.listConfirmed();
    const decided = await this.campaigns.sentSubscriberIds(campaignId);
    const batch = nextBatch(campaign, confirmed, decided, batchSize);

    let sent = 0;
    let suppressed = 0;
    let failed = 0;

    for (const subscriber of batch) {
      const record: DispatchRecord = await this.dispatch.send(
        {
          channel: 'email',
          templateKey: 'newsletter_campaign',
          kind: 'marketing',
          recipient: { contactId: subscriber.id, address: subscriber.email },
          message: {
            channel: 'email',
            subject: campaign.subject,
            body: this.bodyWithUnsubscribe(campaign, subscriber),
            kind: 'marketing',
          },
        },
        at,
      );

      const outcome =
        record.status === 'sent' ? 'sent' : record.status === 'suppressed' ? 'suppressed' : 'failed';
      if (outcome === 'sent') sent += 1;
      else if (outcome === 'suppressed') suppressed += 1;
      else failed += 1;

      await this.campaigns.recordSend({
        campaignId,
        subscriberId: subscriber.id,
        outcome,
        reason: record.reason,
        at: at.toISOString(),
      });
    }

    const decidedAfter = await this.campaigns.sentSubscriberIds(campaignId);
    const remaining = confirmed.filter((s) => !decidedAfter.includes(s.id)).length;
    const current = await this.campaigns.get(campaignId);
    const status = remaining > 0 ? 'sending' : 'sent';
    if (current && remaining === 0) await this.campaigns.update(markSent(current, at));

    return { campaignId, attempted: batch.length, sent, suppressed, failed, remaining, status };
  }

  /** Every marketing message carries a working unsubscribe link, which is what
   * makes the opt-in revocable rather than a one-way door (CPA s11, POPIA s11). */
  bodyWithUnsubscribe(campaign: Campaign, subscriber: Subscriber): string {
    const link = `${this.siteUrl}/notifications/unsubscribe?token=${subscriber.unsubscribeToken}`;
    return `${campaign.bodyMd}\n\n--\nUnsubscribe: ${link}`;
  }

  private async sendConfirmation(subscriber: Subscriber): Promise<void> {
    const link = `${this.siteUrl}/notifications/subscribe/confirm?token=${subscriber.confirmToken}`;
    await this.dispatch.send(
      {
        channel: 'email',
        templateKey: 'newsletter_confirmation',
        kind: 'transactional',
        recipient: { contactId: subscriber.id, address: subscriber.email },
        message: {
          channel: 'email',
          subject: 'Confirm your Amazing Goats newsletter',
          body: `Please confirm your subscription: ${link}\n\nIf you did not ask for this, ignore this email and nothing will be sent.`,
          kind: 'transactional',
        },
      },
      new Date(),
    );
  }
}
