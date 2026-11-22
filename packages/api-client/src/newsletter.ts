/**
 * Newsletter types shared by the storefront and the staff portals.
 *
 * The subscribe call deliberately has no "is this address on the list?" result:
 * the service answers `accepted` for every address, so a caller cannot use the
 * endpoint to enumerate subscribers. That is why `SubscribeResult` carries a
 * single field and not a status enum.
 */

export type SubscriberStatus = 'pending' | 'confirmed' | 'unsubscribed' | 'bounced' | 'complained';

export interface SubscriberView {
  id: string;
  email: string;
  status: SubscriberStatus;
  source: string;
  confirmedAt?: string;
  unsubscribedAt?: string;
  createdAt: string;
}

export interface SubscribeResult {
  status: 'accepted';
}

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';

export interface CampaignView {
  id: string;
  subject: string;
  status: CampaignStatus;
  scheduledFor?: string;
  sentAt?: string;
  createdBy: string;
  createdAt: string;
}

export type SendOutcome = 'sent' | 'suppressed' | 'failed' | 'skipped';

export interface CampaignSendView {
  campaignId: string;
  subscriberId: string;
  outcome: SendOutcome;
  reason: string;
  at: string;
}

export interface CampaignTickResult {
  campaignId: string;
  attempted: number;
  sent: number;
  suppressed: number;
  failed: number;
  remaining: number;
  status: CampaignStatus;
}

/** The three public newsletter routes, so a client does not build a URL by hand. */
export function subscribePath(): string {
  return '/notifications/subscribe';
}

export function confirmPath(token: string): string {
  return `/notifications/subscribe/confirm?token=${encodeURIComponent(token)}`;
}

export function unsubscribePath(token: string): string {
  return `/notifications/unsubscribe?token=${encodeURIComponent(token)}`;
}
