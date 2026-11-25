import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { DeliveryWebhookService } from './webhook.service';
import { InMemoryDeliveryStore, InMemorySuppressionStore } from './delivery';

const secret = 'whsec_' + Buffer.from('a-test-signing-key').toString('base64');
const now = new Date('2026-01-01T10:00:00Z');
const timestampSec = Math.floor(now.getTime() / 1000);

function signedHeaders(body: string, id = 'msg_1', ts = timestampSec) {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signature = createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
  return {
    'svix-id': id,
    'svix-timestamp': String(ts),
    'svix-signature': `v1,${signature}`,
  };
}

/** `null` means "no secret configured"; `undefined` would hit the default parameter. */
function service(withSecret: string | null = secret) {
  const deliveries = new InMemoryDeliveryStore();
  const suppressions = new InMemorySuppressionStore();
  return {
    deliveries,
    suppressions,
    webhook: new DeliveryWebhookService(deliveries, suppressions, withSecret ?? undefined),
  };
}

const deliveredBody = JSON.stringify({
  type: 'email.delivered',
  data: { email_id: 're_1', to: 'thabo@example.com' },
});
const bouncedBody = JSON.stringify({
  type: 'email.bounced',
  data: { email_id: 're_2', to: 'thabo@example.com' },
});
const complainedBody = JSON.stringify({
  type: 'email.complained',
  data: { email_id: 're_3', to: 'thabo@example.com' },
});

describe('DeliveryWebhookService', () => {
  it('records a delivered event against the provider reference', async () => {
    const { webhook, deliveries } = service();
    const result = await webhook.receive({
      headers: signedHeaders(deliveredBody),
      rawBody: deliveredBody,
      now,
    });

    expect(result).toEqual({ accepted: true, event: 'delivered', providerRef: 're_1' });
    const records = await deliveries.forMessage('re_1');
    expect(records).toHaveLength(1);
    expect(records[0].address).toBe('thabo@example.com');
  });

  it('writes nothing when the signature does not verify', async () => {
    const { webhook, deliveries, suppressions } = service();
    const result = await webhook.receive({
      headers: { ...signedHeaders(deliveredBody), 'svix-signature': 'v1,bm90LXZhbGlk' },
      rawBody: deliveredBody,
      now,
    });

    expect(result).toEqual({ accepted: false, reason: 'unverified' });
    expect(await deliveries.forMessage('re_1')).toEqual([]);
    expect(await suppressions.list()).toEqual([]);
  });

  it('rejects every webhook when no signing secret is configured', async () => {
    const { webhook } = service(null);
    const result = await webhook.receive({
      headers: signedHeaders(deliveredBody),
      rawBody: deliveredBody,
      now,
    });
    expect(result).toEqual({ accepted: false, reason: 'unverified' });
  });

  it('rejects a body that was altered after signing', async () => {
    const { webhook, deliveries } = service();
    const result = await webhook.receive({
      headers: signedHeaders(deliveredBody),
      rawBody: deliveredBody.replace('thabo', 'someone'),
      now,
    });
    expect(result).toEqual({ accepted: false, reason: 'unverified' });
    expect(await deliveries.forMessage('re_1')).toEqual([]);
  });

  it('suppresses marketing to an address that bounced', async () => {
    const { webhook, suppressions } = service();
    await webhook.receive({ headers: signedHeaders(bouncedBody, 'msg_2'), rawBody: bouncedBody, now });
    expect(await suppressions.isSuppressed('thabo@example.com')).toBe(true);
  });

  it('suppresses marketing to an address that complained', async () => {
    const { webhook, suppressions } = service();
    await webhook.receive({
      headers: signedHeaders(complainedBody, 'msg_3'),
      rawBody: complainedBody,
      now,
    });
    expect(await suppressions.isSuppressed('THABO@example.com')).toBe(true);
  });

  it('does not suppress an address merely because a message was delivered', async () => {
    const { webhook, suppressions } = service();
    await webhook.receive({ headers: signedHeaders(deliveredBody), rawBody: deliveredBody, now });
    expect(await suppressions.isSuppressed('thabo@example.com')).toBe(false);
  });

  it('ignores an event type the platform does not act on, and records nothing', async () => {
    const { webhook, deliveries } = service();
    const opened = JSON.stringify({ type: 'email.opened', data: { email_id: 're_9' } });
    const result = await webhook.receive({
      headers: signedHeaders(opened, 'msg_9'),
      rawBody: opened,
      now,
    });
    expect(result).toEqual({ accepted: true, ignored: 'email.opened' });
    expect(await deliveries.forMessage('re_9')).toEqual([]);
  });

  it('reports a malformed body rather than throwing', async () => {
    const { webhook } = service();
    const body = 'not json';
    const result = await webhook.receive({ headers: signedHeaders(body), rawBody: body, now });
    expect(result).toEqual({ accepted: false, reason: 'malformed' });
  });

  it('takes the first address when the provider reports several', async () => {
    const { webhook, deliveries } = service();
    const body = JSON.stringify({
      type: 'email.delivered',
      data: { email_id: 're_5', to: ['first@example.com', 'second@example.com'] },
    });
    await webhook.receive({ headers: signedHeaders(body, 'msg_5'), rawBody: body, now });
    expect((await deliveries.forMessage('re_5'))[0].address).toBe('first@example.com');
  });
});
