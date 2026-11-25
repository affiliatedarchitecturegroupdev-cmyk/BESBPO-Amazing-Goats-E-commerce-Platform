import type { Subscriber } from './subscriber';

/**
 * Campaigns. A send is paced and resumable, because the failure mode that
 * matters is a provider rate limit or a restart halfway through a list: the
 * wrong answers are a double send (the person gets two) or a stranded remainder
 * (half the list never hears). One row per recipient is the guarantee.
 */

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';

export interface Campaign {
  id: string;
  subject: string;
  bodyMd: string;
  status: CampaignStatus;
  scheduledFor?: string;
  sentAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type SendOutcome = 'sent' | 'suppressed' | 'failed' | 'skipped';

export interface CampaignSend {
  campaignId: string;
  subscriberId: string;
  outcome: SendOutcome;
  reason: string;
  at: string;
}

export interface CampaignStore {
  create(campaign: Campaign): Promise<Campaign>;
  get(id: string): Promise<Campaign | undefined>;
  update(campaign: Campaign): Promise<Campaign>;
  list(): Promise<Campaign[]>;
  /** Record one recipient's outcome. A duplicate must not create a second row. */
  recordSend(send: CampaignSend): Promise<CampaignSend>;
  /** The recipients already decided for a campaign, so a resume can skip them. */
  sentSubscriberIds(campaignId: string): Promise<string[]>;
  sends(campaignId: string): Promise<CampaignSend[]>;
}

export class InMemoryCampaignStore implements CampaignStore {
  private readonly campaigns = new Map<string, Campaign>();
  private readonly sendRows: CampaignSend[] = [];

  async create(campaign: Campaign): Promise<Campaign> {
    this.campaigns.set(campaign.id, campaign);
    return campaign;
  }

  async get(id: string): Promise<Campaign | undefined> {
    return this.campaigns.get(id);
  }

  async update(campaign: Campaign): Promise<Campaign> {
    this.campaigns.set(campaign.id, campaign);
    return campaign;
  }

  async list(): Promise<Campaign[]> {
    return [...this.campaigns.values()];
  }

  async recordSend(send: CampaignSend): Promise<CampaignSend> {
    const exists = this.sendRows.some(
      (s) => s.campaignId === send.campaignId && s.subscriberId === send.subscriberId,
    );
    if (exists) return send;
    this.sendRows.push(send);
    return send;
  }

  async sentSubscriberIds(campaignId: string): Promise<string[]> {
    return this.sendRows.filter((s) => s.campaignId === campaignId).map((s) => s.subscriberId);
  }

  async sends(campaignId: string): Promise<CampaignSend[]> {
    return this.sendRows.filter((s) => s.campaignId === campaignId);
  }
}

/** How many recipients one tick handles. Bounded so one tick cannot run long
 * enough to trip a provider limit or a request timeout. */
export const DEFAULT_BATCH_SIZE = 25;

/**
 * Chooses the recipients for the next tick: confirmed subscribers, in list
 * order, excluding anyone already decided for this campaign. A `bounced` or
 * `complained` subscriber is already excluded because they are not `confirmed`,
 * but the check is explicit so a future status cannot quietly leak them in.
 */
export function nextBatch(
  campaign: Campaign,
  confirmed: Subscriber[],
  alreadyDecided: string[],
  batchSize: number = DEFAULT_BATCH_SIZE,
): Subscriber[] {
  const decided = new Set(alreadyDecided);
  return confirmed
    .filter((subscriber) => !decided.has(subscriber.id))
    .filter((subscriber) => subscriber.status === 'confirmed')
    .slice(0, Math.max(0, batchSize));
}

/**
 * Whether a campaign may be sent. A draft is started deliberately; a scheduled
 * campaign may start once its time has passed; `sending` may resume after a
 * restart; `sent` and `cancelled` are terminal, so a replayed request cannot
 * re-send a finished campaign.
 */
export function canStartSend(campaign: Campaign, now: Date = new Date()): boolean {
  if (campaign.status === 'draft') return true;
  if (campaign.status === 'sending') return true;
  if (campaign.status === 'scheduled') {
    return !campaign.scheduledFor || new Date(campaign.scheduledFor) <= now;
  }
  return false;
}

/**
 * The campaign's status after one tick. `sent` only when every confirmed
 * recipient has a row, so a tick that ends mid-list leaves it `sending` and the
 * next tick resumes rather than declaring success.
 */
export function statusAfterTick(remaining: number, now: Date = new Date()): CampaignStatus {
  return remaining > 0 ? 'sending' : 'sent';
}

/** Marks a campaign as started, so a crash mid-tick leaves it resumable. */
export function markSending(campaign: Campaign, now: Date = new Date()): Campaign {
  if (campaign.status === 'sending') return campaign;
  return { ...campaign, status: 'sending', updatedAt: now.toISOString() };
}

export function markSent(campaign: Campaign, now: Date = new Date()): Campaign {
  const when = now.toISOString();
  return { ...campaign, status: 'sent', sentAt: when, updatedAt: when };
}
