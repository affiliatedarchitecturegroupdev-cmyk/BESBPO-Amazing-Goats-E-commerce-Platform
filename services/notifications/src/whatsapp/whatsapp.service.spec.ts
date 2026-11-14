import { describe, it, expect, vi } from 'vitest';
import { WhatsappService } from './whatsapp.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { InMemoryDispatchLog, MessageTransport } from '../dispatch/dispatch';
import { InMemoryConsentStore } from '../consent/consent';

function build() {
  const sent: string[] = [];
  const transport: MessageTransport = {
    channel: 'whatsapp',
    send: vi.fn(async () => {
      sent.push('whatsapp');
      return { providerRef: 'ref' };
    }),
  };
  const dispatch = new DispatchService(new InMemoryConsentStore(), new InMemoryDispatchLog(), [
    transport,
  ]);
  return { service: new WhatsappService(dispatch), sent };
}

describe('WhatsappService', () => {
  it('starts empty', () => {
    const { service } = build();
    expect(service.list()).toEqual([]);
  });

  it('sends a transactional template over whatsapp and lists it', async () => {
    const { service, sent } = build();
    const record = await service.send({
      templateKey: 'cutoff_reminder',
      recipient: { contactId: 'c1', address: 'dest' },
      values: {
        customerName: 'A',
        orderNumber: 'AG-1',
        cutoffAt: '2026-11-15T15:00:00Z',
        window: '24h',
      },
    });
    expect(record.status).toBe('sent');
    expect(record.channel).toBe('whatsapp');
    expect(sent).toHaveLength(1);
    expect(service.list()).toHaveLength(1);
  });
});
