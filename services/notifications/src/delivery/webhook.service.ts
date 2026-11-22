import {
  parseDeliveryEvent,
  verifySvixSignature,
  type ResendWebhookPayload,
} from '../channels/resend';
import type { DeliveryRecord, DeliveryStore, SuppressionStore } from './delivery';

export interface WebhookHeaders {
  'svix-id'?: string;
  'svix-timestamp'?: string;
  'svix-signature'?: string;
}

export interface WebhookInput {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
  now?: Date;
}

export type WebhookResult =
  | { accepted: true; event: DeliveryRecord['event']; providerRef: string }
  | { accepted: true; ignored: string }
  | { accepted: false; reason: 'unverified' | 'malformed' };

function header(headers: WebhookInput['headers'], name: keyof WebhookHeaders): string | undefined {
  const value = headers[name];
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

/**
 * Receives Resend delivery webhooks. A webhook is the only way to know that a
 * message the provider accepted was actually delivered: without it `sent` in the
 * dispatch log means "the provider took it", which is not the same thing, and a
 * bounced order confirmation would go unnoticed.
 *
 * The signature is verified over the raw body before anything is parsed, and an
 * unverified request writes nothing.
 */
export class DeliveryWebhookService {
  constructor(
    private readonly deliveries: DeliveryStore,
    private readonly suppressions: SuppressionStore,
    private readonly secret: string | undefined,
  ) {}

  async receive(input: WebhookInput): Promise<WebhookResult> {
    if (!this.secret) return { accepted: false, reason: 'unverified' };

    const verified = verifySvixSignature({
      secret: this.secret,
      rawBody: input.rawBody,
      id: header(input.headers, 'svix-id'),
      timestampSec: Number(header(input.headers, 'svix-timestamp')),
      signature: header(input.headers, 'svix-signature'),
      now: input.now,
    });
    if (!verified) return { accepted: false, reason: 'unverified' };

    let payload: ResendWebhookPayload;
    try {
      payload = JSON.parse(input.rawBody) as ResendWebhookPayload;
    } catch {
      return { accepted: false, reason: 'malformed' };
    }

    const parsed = parseDeliveryEvent(payload);
    if (!parsed) return { accepted: true, ignored: payload.type ?? 'unknown' };

    const rawTo = payload.data?.to;
    const address = Array.isArray(rawTo) ? rawTo[0] : rawTo;
    await this.deliveries.record({
      providerRef: parsed.providerRef,
      event: parsed.event,
      address,
      at: (input.now ?? new Date()).toISOString(),
    });

    // A bounce or a complaint is a person saying they do not want this mail, so
    // the address stops receiving marketing. A delivered event carries no such
    // meaning and suppresses nothing.
    if (address && parsed.event !== 'delivered') {
      await this.suppressions.suppress(address, parsed.event);
    }

    return { accepted: true, event: parsed.event, providerRef: parsed.providerRef };
  }
}
