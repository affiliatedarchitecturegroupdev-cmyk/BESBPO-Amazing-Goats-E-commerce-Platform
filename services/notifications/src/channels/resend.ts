import { createHmac, timingSafeEqual } from 'node:crypto';
import type { MessageTransport, Recipient, TransportResult } from '../dispatch/dispatch';
import type { Message } from '../templates/template';
import { renderHtml } from '../templates/html';

/**
 * Resend (https://resend.com) as the email provider. The transport contract
 * already exists (`MessageTransport`), so this is a body shape and an endpoint
 * rather than a new architecture: `HttpTransport` remains for any other provider.
 *
 * The body carries both `html` and `text`. A text part is always sent because a
 * client that cannot render HTML, or a reader that prefers it, must still get the
 * message; an HTML-only email is a message some customers never see.
 */

/** Resend's send endpoint. Overridable so a test never contacts the provider. */
export const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export interface ResendConfig {
  apiKey: string;
  /** The `from` for order and account messages, e.g. `orders@amazinggoats.store`. */
  transactionalFrom: string;
  /** The `from` for newsletter and campaign messages. */
  marketingFrom: string;
  /** Optional `reply-to`, so a customer replying reaches a person. */
  replyTo?: string;
  endpoint?: string;
  fetchFn?: typeof fetch;
}

export interface ResendEmailBody {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  reply_to?: string;
}

/**
 * The sending identity for a message. Transactional and marketing send from
 * different addresses so a marketing complaint cannot degrade the deliverability
 * of `order_confirmation` (ADR 0013). An unclassified message is treated as
 * transactional: the safer default, because transactional mail is the mail a
 * customer needs.
 */
export function fromAddressFor(config: Pick<ResendConfig, 'transactionalFrom' | 'marketingFrom'>, message: Message): string {
  return message.kind === 'marketing' ? config.marketingFrom : config.transactionalFrom;
}

/** The JSON body Resend expects, with both parts of the message. */
export function resendBody(config: ResendConfig, recipient: Recipient, message: Message): ResendEmailBody {
  const body: ResendEmailBody = {
    from: fromAddressFor(config, message),
    to: recipient.address,
    subject: message.subject ?? '',
    html: renderHtml(message),
    text: message.body,
  };
  if (config.replyTo) body.reply_to = config.replyTo;
  return body;
}

export class ResendTransport implements MessageTransport {
  readonly channel = 'email' as const;
  private readonly fetchFn: typeof fetch;
  private readonly endpoint: string;

  constructor(private readonly config: ResendConfig) {
    this.fetchFn = config.fetchFn ?? fetch;
    this.endpoint = config.endpoint ?? RESEND_ENDPOINT;
  }

  async send(recipient: Recipient, message: Message): Promise<TransportResult> {
    const response = await this.fetchFn(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(resendBody(this.config, recipient, message)),
    });
    if (!response.ok) throw new Error(`resend returned ${response.status}`);
    const json = (await response.json().catch(() => ({}))) as { id?: string };
    if (!json.id) throw new Error('resend returned no message id');
    return { providerRef: json.id };
  }
}

/**
 * Resend delivers webhooks through Svix. The signed content is
 * `"<svix-id>.<svix-timestamp>.<rawBody>"` and the expected value is
 * `base64(HMAC-SHA256(base64(secret), signedContent))`; the signature header may
 * carry several `v1,<base64>` entries while a secret is rotated, so any match
 * passes. A timestamp outside the tolerance window is rejected so a captured body
 * cannot be replayed.
 *
 * This mirrors the helper in `services/payments/src/providers/webhook-signature.ts`
 * rather than importing it: a service reads only its own code, and coupling
 * notifications to payments would cross a service boundary and a human gate.
 */
export interface SvixCheck {
  /** The endpoint signing secret, as `whsec_<base64>` or the bare base64. */
  secret: string;
  rawBody: string;
  /** `svix-id` header: the message id, part of the signed content. */
  id: string | undefined;
  /** `svix-timestamp` header, in seconds, part of the signed content. */
  timestampSec: number | undefined;
  /** `svix-signature` header: a space-delimited list of `v1,<base64>` entries. */
  signature: string | undefined;
  toleranceSec?: number;
  now?: Date;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifySvixSignature(check: SvixCheck): boolean {
  const { secret, rawBody, id, timestampSec, signature } = check;
  if (!id || !signature || !Number.isFinite(timestampSec)) return false;

  const tolerance = check.toleranceSec ?? 300;
  const nowSec = Math.floor((check.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSec - (timestampSec as number)) > tolerance) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key)
    .update(`${id}.${timestampSec}.${rawBody}`)
    .digest('base64');
  return signature
    .split(' ')
    .map((entry) => entry.split(',')[1])
    .filter((value): value is string => Boolean(value))
    .some((value) => safeEqual(expected, value));
}

/** The delivery outcomes Resend reports that the platform acts on. */
export type DeliveryEvent = 'delivered' | 'bounced' | 'complained';

const EVENT_TYPES: Record<string, DeliveryEvent> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

export interface ResendWebhookPayload {
  type?: string;
  data?: { email_id?: string; to?: string | string[] };
}

export interface ParsedDeliveryEvent {
  event: DeliveryEvent;
  providerRef: string;
}

/**
 * Reads a Resend webhook into the outcome the platform records. Returns
 * `undefined` for every event the platform does not act on (`email.sent`,
 * `email.opened`, …), so an unhandled type is ignored rather than guessed at.
 */
export function parseDeliveryEvent(payload: ResendWebhookPayload): ParsedDeliveryEvent | undefined {
  const event = payload.type ? EVENT_TYPES[payload.type] : undefined;
  const providerRef = payload.data?.email_id;
  if (!event || !providerRef) return undefined;
  return { event, providerRef };
}
