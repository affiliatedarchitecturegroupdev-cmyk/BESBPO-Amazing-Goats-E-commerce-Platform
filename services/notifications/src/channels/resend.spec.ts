import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  ResendTransport,
  fromAddressFor,
  parseDeliveryEvent,
  resendBody,
  verifySvixSignature,
} from './resend';
import type { Recipient } from '../dispatch/dispatch';
import type { Message } from '../templates/template';

const recipient: Recipient = { contactId: 'c1', address: 'thabo@example.com' };
const transactional: Message = {
  channel: 'email',
  subject: 'Order 42 confirmed',
  body: 'Hi Thabo',
  kind: 'transactional',
};
const marketing: Message = { ...transactional, kind: 'marketing' };

const config = {
  apiKey: 're_test',
  transactionalFrom: 'orders@amazinggoats.store',
  marketingFrom: 'news@amazinggoats.store',
};

function okResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}

describe('fromAddressFor', () => {
  it('sends transactional mail from the transactional identity', () => {
    expect(fromAddressFor(config, transactional)).toBe('orders@amazinggoats.store');
  });

  it('sends marketing mail from the marketing identity, so a complaint cannot hurt order mail', () => {
    expect(fromAddressFor(config, marketing)).toBe('news@amazinggoats.store');
  });

  it('treats an unclassified message as transactional', () => {
    expect(fromAddressFor(config, { channel: 'email', body: 'x' })).toBe(
      'orders@amazinggoats.store',
    );
  });
});

describe('resendBody', () => {
  it('carries both an html and a text part', () => {
    const body = resendBody(config, recipient, transactional);
    expect(body.text).toBe('Hi Thabo');
    expect(body.html).toContain('Hi Thabo');
    expect(body.html).toContain('<!doctype html>');
  });

  it('addresses the recipient and keeps the subject', () => {
    const body = resendBody(config, recipient, transactional);
    expect(body.to).toBe('thabo@example.com');
    expect(body.subject).toBe('Order 42 confirmed');
  });

  it('omits reply_to when none is configured', () => {
    expect(resendBody(config, recipient, transactional)).not.toHaveProperty('reply_to');
  });

  it('includes reply_to when configured, so a reply reaches a person', () => {
    const body = resendBody({ ...config, replyTo: 'hello@amazinggoats.store' }, recipient, transactional);
    expect(body.reply_to).toBe('hello@amazinggoats.store');
  });
});

describe('ResendTransport', () => {
  it('POSTs the body to Resend with a bearer token and returns the provider id', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const transport = new ResendTransport({
      ...config,
      fetchFn: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return okResponse({ id: 're_msg_1' });
      }) as unknown as typeof fetch,
    });

    const result = await transport.send(recipient, transactional);

    expect(result.providerRef).toBe('re_msg_1');
    expect(calls[0].url).toBe('https://api.resend.com/emails');
    expect(calls[0].init.headers).toMatchObject({ authorization: 'Bearer re_test' });
    const sent = JSON.parse(calls[0].init.body as string);
    expect(sent.to).toBe('thabo@example.com');
    expect(sent.html).toContain('Hi Thabo');
    expect(sent.text).toBe('Hi Thabo');
  });

  it('throws on a non-2xx response rather than reporting a send', async () => {
    const transport = new ResendTransport({
      ...config,
      fetchFn: (async () => okResponse({}, 422)) as unknown as typeof fetch,
    });
    await expect(transport.send(recipient, transactional)).rejects.toThrow('422');
  });

  it('throws when the provider returns no message id', async () => {
    const transport = new ResendTransport({
      ...config,
      fetchFn: (async () => okResponse({})) as unknown as typeof fetch,
    });
    await expect(transport.send(recipient, transactional)).rejects.toThrow('no message id');
  });
});

describe('verifySvixSignature', () => {
  const secret = 'whsec_' + Buffer.from('a-test-signing-key').toString('base64');
  const rawBody = JSON.stringify({ type: 'email.delivered' });
  const now = new Date('2026-01-01T10:00:00Z');
  const timestampSec = Math.floor(now.getTime() / 1000);

  function sign(id: string, ts: number, body: string): string {
    const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const value = createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
    return `v1,${value}`;
  }

  it('accepts a correctly signed body', () => {
    expect(
      verifySvixSignature({
        secret,
        rawBody,
        id: 'msg_1',
        timestampSec,
        signature: sign('msg_1', timestampSec, rawBody),
        now,
      }),
    ).toBe(true);
  });

  it('rejects a body that was altered after signing', () => {
    expect(
      verifySvixSignature({
        secret,
        rawBody: JSON.stringify({ type: 'email.complained' }),
        id: 'msg_1',
        timestampSec,
        signature: sign('msg_1', timestampSec, rawBody),
        now,
      }),
    ).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    const other = 'whsec_' + Buffer.from('another-key').toString('base64');
    const key = Buffer.from(other.replace(/^whsec_/, ''), 'base64');
    const value = createHmac('sha256', key).update(`msg_1.${timestampSec}.${rawBody}`).digest('base64');
    expect(
      verifySvixSignature({
        secret,
        rawBody,
        id: 'msg_1',
        timestampSec,
        signature: `v1,${value}`,
        now,
      }),
    ).toBe(false);
  });

  it('rejects a replayed body outside the tolerance window', () => {
    const old = timestampSec - 3600;
    expect(
      verifySvixSignature({
        secret,
        rawBody,
        id: 'msg_1',
        timestampSec: old,
        signature: sign('msg_1', old, rawBody),
        now,
      }),
    ).toBe(false);
  });

  it('accepts any of several signatures while a secret is rotated', () => {
    const good = sign('msg_1', timestampSec, rawBody);
    expect(
      verifySvixSignature({
        secret,
        rawBody,
        id: 'msg_1',
        timestampSec,
        signature: `v1,bm90LXRoZS1yaWdodC1vbmU= ${good}`,
        now,
      }),
    ).toBe(true);
  });

  it('rejects when a header is missing', () => {
    expect(
      verifySvixSignature({
        secret,
        rawBody,
        id: undefined,
        timestampSec,
        signature: sign('msg_1', timestampSec, rawBody),
        now,
      }),
    ).toBe(false);
  });
});

describe('parseDeliveryEvent', () => {
  it('reads the events the platform acts on', () => {
    expect(parseDeliveryEvent({ type: 'email.delivered', data: { email_id: 'e1' } })).toEqual({
      event: 'delivered',
      providerRef: 'e1',
    });
    expect(parseDeliveryEvent({ type: 'email.bounced', data: { email_id: 'e1' } })?.event).toBe(
      'bounced',
    );
    expect(parseDeliveryEvent({ type: 'email.complained', data: { email_id: 'e1' } })?.event).toBe(
      'complained',
    );
  });

  it('ignores an event the platform does not act on', () => {
    expect(parseDeliveryEvent({ type: 'email.opened', data: { email_id: 'e1' } })).toBeUndefined();
    expect(parseDeliveryEvent({ type: 'email.sent', data: { email_id: 'e1' } })).toBeUndefined();
  });

  it('ignores a payload with no message id', () => {
    expect(parseDeliveryEvent({ type: 'email.delivered', data: {} })).toBeUndefined();
  });
});
