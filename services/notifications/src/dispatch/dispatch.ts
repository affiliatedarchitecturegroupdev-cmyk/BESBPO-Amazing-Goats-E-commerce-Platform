import type { Channel, Message } from '../templates/template';

/** Where a message goes once rendered: an email address, phone number or contact id. */
export interface Recipient {
  contactId: string;
  address: string;
}

export interface TransportResult {
  providerRef: string;
}

/**
 * The one interface every channel implements (email, WhatsApp, SMS), so the
 * dispatch service never branches on the channel. A transport is injected, so a
 * test uses a recording transport and never contacts a real provider.
 */
export interface MessageTransport {
  readonly channel: Channel;
  send(recipient: Recipient, message: Message): Promise<TransportResult>;
}

export type DispatchStatus = 'sent' | 'suppressed' | 'failed';

export interface DispatchRecord {
  id: string;
  channel: Channel;
  templateKey: string;
  contactId: string;
  status: DispatchStatus;
  reason: string;
  providerRef?: string;
  at: string;
}

export interface DispatchLog {
  record(entry: DispatchRecord): Promise<DispatchRecord>;
  list(): Promise<DispatchRecord[]>;
}

/** In-memory dispatch log; the SQL adapter writes `notifications.messages`. */
export class InMemoryDispatchLog implements DispatchLog {
  private readonly entries: DispatchRecord[] = [];

  async record(entry: DispatchRecord): Promise<DispatchRecord> {
    this.entries.push(entry);
    return entry;
  }

  async list(): Promise<DispatchRecord[]> {
    return [...this.entries];
  }
}
