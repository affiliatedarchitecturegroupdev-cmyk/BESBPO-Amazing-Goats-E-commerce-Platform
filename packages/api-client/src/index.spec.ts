import { describe, expect, it, vi } from 'vitest';
import { ApiError, createClient, type FetchLike } from './index';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** A fetch stub that records each call and answers from a queue of responses. */
function stubFetch(...responses: Response[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected call to ${url}`);
    return next;
  };
  return { impl, calls };
}

describe('api-client', () => {
  it('builds catalogue query strings and skips empty filters', async () => {
    const { impl, calls } = stubFetch(jsonResponse([]));
    await createClient('https://gw.example', () => ({}), impl).catalogue({ category: 'lamb', phase: 1, line: '' });
    expect(calls[0].url).toBe('https://gw.example/commerce/catalog?category=lamb&phase=1');
  });

  it('sends the caller bearer token from getHeaders', async () => {
    const { impl, calls } = stubFetch(jsonResponse([]));
    const client = createClient('https://gw.example', () => ({ authorization: 'Bearer t' }), impl);
    await client.creditLimits();
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer t');
    expect(headers['content-type']).toBe('application/json');
  });

  it('posts an order with a JSON body', async () => {
    const { impl, calls } = stubFetch(jsonResponse({ id: 'o1', status: 'pending_payment', subtotalExVatCents: 0, vatCents: 0, totalIncVatCents: 0 }));
    const order = await createClient('https://gw.example', () => ({}), impl).createOrder({
      lines: [{ sku: 'AG-LM-001', qty: 1, unitPriceExVatCents: 1000, fulfilment: 'in_stock', temperature: 'chilled' }],
    });
    expect(order.id).toBe('o1');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({ lines: [{ sku: 'AG-LM-001', qty: 1 }] });
  });

  it('encodes path parameters', async () => {
    const { impl, calls } = stubFetch(jsonResponse({}));
    await createClient('https://gw.example', () => ({}), impl).statement('org/1');
    expect(calls[0].url).toBe('https://gw.example/accounts/statements/org%2F1');
  });

  it('throws ApiError with the status on a failed call', async () => {
    const { impl } = stubFetch(new Response('', { status: 403 }));
    const client = createClient('https://gw.example', () => ({}), impl);
    const err = await client.home().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, path: '/gateway/bff/home' });
  });

  it('returns undefined for a 204 No Content response', async () => {
    const { impl } = stubFetch(new Response(null, { status: 204 }));
    await expect(createClient('https://gw.example', () => ({}), impl).serveAds('A1')).resolves.toBeUndefined();
  });
});
