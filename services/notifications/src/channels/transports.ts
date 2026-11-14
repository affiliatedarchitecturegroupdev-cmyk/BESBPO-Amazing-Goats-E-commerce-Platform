import type { Channel, Message } from '../templates/template';
import type { MessageTransport, Recipient, TransportResult } from '../dispatch/dispatch';

export interface HttpTransportConfig {
  channel: Channel;
  /** The provider endpoint the message is POSTed to. */
  url: string;
  /** Bearer token for the provider. Never logged. */
  token: string;
  /** Builds the provider-specific JSON body. */
  buildBody: (recipient: Recipient, message: Message) => unknown;
  /** Overridable for tests. */
  fetchFn?: typeof fetch;
}

/**
 * A channel transport that POSTs JSON to a provider endpoint. Email and WhatsApp
 * differ only in the URL, the token and the body shape, so one class serves
 * both and a test injects a recording `fetchFn` instead of contacting a
 * provider.
 */
export class HttpTransport implements MessageTransport {
  readonly channel: Channel;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly config: HttpTransportConfig) {
    this.channel = config.channel;
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async send(recipient: Recipient, message: Message): Promise<TransportResult> {
    const response = await this.fetchFn(this.config.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.token}`,
      },
      body: JSON.stringify(this.config.buildBody(recipient, message)),
    });
    if (!response.ok) throw new Error(`${this.channel} provider returned ${response.status}`);
    const json = (await response.json().catch(() => ({}))) as { id?: string; message_id?: string };
    return { providerRef: String(json.message_id ?? json.id ?? `sent_${Date.now()}`) };
  }
}

/**
 * Builds the transports from the environment. A channel is registered only when
 * its endpoint and token are present, so a missing channel makes dispatch
 * record `failed: no_transport` rather than sending to a half-configured
 * provider.
 */
export function transportsFromEnv(env: NodeJS.ProcessEnv = process.env): MessageTransport[] {
  const transports: MessageTransport[] = [];

  if (env.EMAIL_API_URL && env.EMAIL_API_KEY) {
    transports.push(
      new HttpTransport({
        channel: 'email',
        url: env.EMAIL_API_URL,
        token: env.EMAIL_API_KEY,
        buildBody: (recipient, message) => ({
          to: recipient.address,
          subject: message.subject,
          body: message.body,
        }),
      }),
    );
  }

  if (env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_TOKEN) {
    transports.push(
      new HttpTransport({
        channel: 'whatsapp',
        url: `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        token: env.WHATSAPP_TOKEN,
        buildBody: (recipient, message) => ({
          messaging_product: 'whatsapp',
          to: recipient.address,
          type: 'text',
          text: { body: message.body },
        }),
      }),
    );
  }

  return transports;
}
