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

  it('reads many prices in one call, comma-joined and encoded', async () => {
    const { impl, calls } = stubFetch(jsonResponse({ 'AG-EG-001': { priceExVatCents: 4500 } }));
    const prices = await createClient('https://gw.example', () => ({}), impl).prices(['AG-EG-001', 'AG-LB-005']);
    expect(calls[0].url).toBe('https://gw.example/commerce/pricing/prices?skus=AG-EG-001%2CAG-LB-005');
    expect(prices['AG-EG-001'].priceExVatCents).toBe(4500);
  });

  it('sends the audience only when one is named', async () => {
    const { impl, calls } = stubFetch(jsonResponse({}), jsonResponse({}));
    const client = createClient('https://gw.example', () => ({}), impl);
    await client.prices(['AG-EG-001']);
    await client.prices(['AG-EG-001'], 'trader');
    expect(calls[0].url).not.toContain('audience');
    expect(calls[1].url).toContain('audience=trader');
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

  it('requests the resolved merchandising page through the gateway BFF', async () => {
    const { impl, calls } = stubFetch(jsonResponse({ view: 'public', page: 'home', sections: [] }));
    const res = await createClient('https://gw.example', () => ({}), impl).merchandisingPage('shop');
    expect(calls[0].url).toBe('https://gw.example/gateway/bff/merchandising?page=shop');
    expect(res.page).toBe('home');
  });

});

describe('session endpoints (T-058)', () => {
  it('builds a login URL a portal can redirect to, encoding the return path', () => {
    const client = createClient('https://api.example');
    expect(client.loginUrl('/orders?tab=open')).toBe(
      'https://api.example/gateway/auth/login?returnTo=%2Forders%3Ftab%3Dopen',
    );
    expect(client.loginUrl()).toBe('https://api.example/gateway/auth/login?returnTo=%2F');
  });

  it('reads the session with the caller cookies attached', async () => {
    const seen: string[] = [];
    const client = createClient(
      'https://api.example',
      () => ({ cookie: 'ag_session=tok' }),
      async (url) => {
        seen.push(url);
        return new Response(
          JSON.stringify({
            user: { id: 'u-1', roles: ['executive'] },
            staff: true,
            issuedAt: null,
            expiresAt: null,
            secondsRemaining: 600,
          }),
          { status: 200 },
        );
      },
    );
    const session = await client.session();
    expect(seen[0]).toBe('https://api.example/gateway/auth/session');
    expect(session.staff).toBe(true);
  });

  it('logs out with a POST', async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    const client = createClient('https://api.example', () => ({}), async (url, init) => {
      calls.push({ url, method: init?.method });
      return new Response(null, { status: 204 });
    });
    await client.logout();
    expect(calls[0]).toEqual({ url: 'https://api.example/gateway/auth/logout', method: 'POST' });
  });
});
