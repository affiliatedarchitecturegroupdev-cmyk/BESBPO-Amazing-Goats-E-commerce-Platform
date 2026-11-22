import { describe, it, expect, vi } from 'vitest';
import { HttpTransport, transportsFromEnv } from './transports';
import type { Recipient } from '../dispatch/dispatch';

const recipient: Recipient = { contactId: 'c1', address: 'thabo@example.com' };
const message = { channel: 'email' as const, subject: 'Hi', body: 'Body' };

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

describe('HttpTransport', () => {
  it('POSTs the built body with a bearer token and reads the provider ref', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return okResponse({ message_id: 'm-42' });
    }) as unknown as typeof fetch;

    const transport = new HttpTransport({
      channel: 'email',
      url: 'https://mail.example/send',
      token: 'tok',
      buildBody: (r, m) => ({ to: r.address, subject: m.subject, body: m.body }),
      fetchFn,
    });

    const result = await transport.send(recipient, message);

    expect(result.providerRef).toBe('m-42');
    expect(calls[0].url).toBe('https://mail.example/send');
    expect(calls[0].init.headers).toMatchObject({ authorization: 'Bearer tok' });
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      to: 'thabo@example.com',
      subject: 'Hi',
      body: 'Body',
    });
  });

  it('throws when the provider returns a non-2xx status', async () => {
    const fetchFn = (async () => ({
      ok: false,
      status: 502,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const transport = new HttpTransport({
      channel: 'whatsapp',
      url: 'https://wa.example/send',
      token: 'tok',
      buildBody: () => ({}),
      fetchFn,
    });

    await expect(transport.send(recipient, { ...message, channel: 'whatsapp' })).rejects.toThrow(
      '502',
    );
  });
});

describe('transportsFromEnv', () => {
  it('registers nothing when no credentials are present', () => {
    expect(transportsFromEnv({})).toEqual([]);
  });

  it('registers email only when both the URL and key are set', () => {
    expect(
      transportsFromEnv({ EMAIL_API_URL: 'https://mail.example' }).map((t) => t.channel),
    ).toEqual([]);
    expect(
      transportsFromEnv({ EMAIL_API_URL: 'https://mail.example', EMAIL_API_KEY: 'k' }).map(
        (t) => t.channel,
      ),
    ).toEqual(['email']);
  });

  it('prefers Resend for email when its API key is set', () => {
    const transports = transportsFromEnv({ RESEND_API_KEY: 're_test' });
    expect(transports.map((t) => t.channel)).toEqual(['email']);
    expect(transports[0].constructor.name).toBe('ResendTransport');
  });

  it('falls back to the generic provider when only EMAIL_API_URL is set', () => {
    const transports = transportsFromEnv({ EMAIL_API_URL: 'https://mail.example', EMAIL_API_KEY: 'k' });
    expect(transports[0].constructor.name).toBe('HttpTransport');
  });

  it('does not register email twice when both providers are configured', () => {
    const channels = transportsFromEnv({
      RESEND_API_KEY: 're_test',
      EMAIL_API_URL: 'https://mail.example',
      EMAIL_API_KEY: 'k',
    }).map((t) => t.channel);
    expect(channels).toEqual(['email']);
  });

  it('registers WhatsApp when its phone number id and token are set', () => {
    const channels = transportsFromEnv({
      WHATSAPP_PHONE_NUMBER_ID: '123',
      WHATSAPP_TOKEN: 'k',
    }).map((t) => t.channel);
    expect(channels).toEqual(['whatsapp']);
  });
});
