import { describe, it, expect, vi } from 'vitest';
import { DispatchService, CONSENT_STORE, DISPATCH_LOG, TRANSPORTS } from './dispatch.service';
import { InMemoryDispatchLog, MessageTransport } from './dispatch';
import { InMemoryConsentStore } from '../consent/consent';

function recordingTransport(channel: 'email' | 'whatsapp' | 'sms') {
  const sent: { to: string; body: string; subject?: string }[] = [];
  const transport: MessageTransport = {
    channel,
    send: vi.fn(async (recipient, message) => {
      sent.push({ to: recipient.address, body: message.body, subject: message.subject });
      return { providerRef: 'ref-1' };
    }),
  };
  return { transport, sent };
}

function service(consent = new InMemoryConsentStore(), transports: MessageTransport[] = []) {
  const log = new InMemoryDispatchLog();
  const dispatch = new DispatchService(consent, log, transports);
  return { dispatch, log };
}

const transactional = {
  channel: 'email' as const,
  templateKey: 'order_confirmation',
  kind: 'transactional' as const,
  recipient: { contactId: 'c1', address: 'thabo@example.com' },
  message: { channel: 'email' as const, subject: 'Order', body: 'Hi' },
};

describe('DispatchService', () => {
  it('sends a transactional message and logs it as sent', async () => {
    const { transport, sent } = recordingTransport('email');
    const { dispatch, log } = service(new InMemoryConsentStore(), [transport]);

    const record = await dispatch.send(transactional, new Date('2026-11-14T10:00:00Z'));

    expect(record.status).toBe('sent');
    expect(record.providerRef).toBe('ref-1');
    expect(sent).toHaveLength(1);
    expect(await log.list()).toHaveLength(1);
  });

  it('suppresses a marketing message when the contact has not opted in', async () => {
    const { transport, sent } = recordingTransport('email');
    const { dispatch } = service(new InMemoryConsentStore(), [transport]);

    const record = await dispatch.send({ ...transactional, kind: 'marketing' });

    expect(record.status).toBe('suppressed');
    expect(record.reason).toBe('unknown_contact');
    expect(sent).toHaveLength(0);
  });

  it('sends marketing to a contact who opted in to the channel', async () => {
    const consent = new InMemoryConsentStore([{ contactId: 'c1', marketing: ['email'] }]);
    const { transport } = recordingTransport('email');
    const { dispatch } = service(consent, [transport]);

    const record = await dispatch.send({ ...transactional, kind: 'marketing' });
    expect(record.status).toBe('sent');
    expect(record.reason).toBe('opted_in');
  });

  it('records a failure when no transport is registered for the channel', async () => {
    const { dispatch } = service();
    const record = await dispatch.send(transactional);
    expect(record.status).toBe('failed');
    expect(record.reason).toBe('no_transport');
  });

  it('records a failure when the transport throws, without leaking the error', async () => {
    const failing: MessageTransport = {
      channel: 'email',
      send: vi.fn(async () => {
        throw new Error('provider down: secret=abc');
      }),
    };
    const { dispatch } = service(new InMemoryConsentStore(), [failing]);

    const record = await dispatch.send(transactional);
    expect(record.status).toBe('failed');
    expect(record.reason).toBe('transport_error');
    expect(JSON.stringify(record)).not.toContain('secret');
  });

  it('reports whether a channel has a transport', () => {
    const { transport } = recordingTransport('email');
    const { dispatch } = service(new InMemoryConsentStore(), [transport]);
    expect(dispatch.hasTransport('email')).toBe(true);
    expect(dispatch.hasTransport('sms')).toBe(false);
  });

  it('exposes the injection tokens the module provides', () => {
    expect([CONSENT_STORE, DISPATCH_LOG, TRANSPORTS].every((t) => typeof t === 'symbol')).toBe(
      true,
    );
  });
});
