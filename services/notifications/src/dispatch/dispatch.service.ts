import { Inject, Injectable } from '@nestjs/common';
import { ConsentStore } from '../consent/consent';
import { decideConsent } from '../consent/consent';
import { DispatchLog, DispatchRecord, MessageTransport, Recipient } from './dispatch';
import type { Channel } from '../templates/template';

export const CONSENT_STORE = Symbol('CONSENT_STORE');
export const DISPATCH_LOG = Symbol('DISPATCH_LOG');
export const TRANSPORTS = Symbol('TRANSPORTS');

export interface SendInput {
  channel: Channel;
  templateKey: string;
  kind: 'transactional' | 'marketing';
  recipient: Recipient;
  message: { channel: Channel; subject?: string; body: string };
}

@Injectable()
export class DispatchService {
  private readonly transports = new Map<Channel, MessageTransport>();

  constructor(
    @Inject(CONSENT_STORE) private readonly consent: ConsentStore,
    @Inject(DISPATCH_LOG) private readonly log: DispatchLog,
    @Inject(TRANSPORTS) transports: MessageTransport[] = [],
  ) {
    for (const transport of transports) this.transports.set(transport.channel, transport);
  }

  hasTransport(channel: Channel): boolean {
    return this.transports.has(channel);
  }

  async list(): Promise<DispatchRecord[]> {
    return this.log.list();
  }

  /**
   * Sends a rendered message if consent allows. A suppressed message is logged
   * with the reason and no transport is called, so a marketing send to someone
   * who has not opted in never leaves the service.
   */
  async send(input: SendInput, at: Date = new Date()): Promise<DispatchRecord> {
    const decision = await decideConsent(this.consent, {
      contactId: input.recipient.contactId,
      channel: input.channel,
      kind: input.kind,
    });

    const base = {
      id: `msg_${at.getTime()}_${(await this.log.list()).length}`,
      channel: input.channel,
      templateKey: input.templateKey,
      contactId: input.recipient.contactId,
      at: at.toISOString(),
    };

    if (!decision.allowed) {
      return this.log.record({ ...base, status: 'suppressed', reason: decision.reason });
    }

    const transport = this.transports.get(input.channel);
    if (!transport) {
      return this.log.record({ ...base, status: 'failed', reason: 'no_transport' });
    }

    try {
      const result = await transport.send(input.recipient, input.message);
      return await this.log.record({
        ...base,
        status: 'sent',
        reason: decision.reason,
        providerRef: result.providerRef,
      });
    } catch {
      return this.log.record({ ...base, status: 'failed', reason: 'transport_error' });
    }
  }
}
