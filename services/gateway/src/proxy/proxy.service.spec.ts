import { describe, it, expect } from 'vitest';
import { FetchLike, Upstreams } from '../bff/upstream';
import { ProxyService, UnknownUpstreamError, type ProxyRequest } from './proxy.service';

/** A fetch stand-in that records each call and answers a canned reply. */
function stubFetch(
  reply: { status?: number; headers?: Record<string, string>; body?: unknown } = {},
  calls: { url: string; init?: { method?: string; headers?: Record<string, string>; body?: unknown } }[] = [],
): FetchLike {
  return async (url, init) => {
    calls.push({ url, init });
    const text = reply.body === undefined ? '' : typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body);
    return {
      ok: (reply.status ?? 200) < 400,
      status: reply.status ?? 200,
      headers: new Headers(reply.headers ?? { 'content-type': 'application/json' }),
      text: async () => text,
      json: async () => (text === '' ? undefined : JSON.parse(text)),
    };
  };
}

const UPSTREAMS: Upstreams = { commerce: 'http://commerce:3001', ads: 'http://ads:3007' };

function req(over: Partial<ProxyRequest> = {}): ProxyRequest {
  return {
    method: 'GET',
    originalUrl: '/commerce/catalog',
    headers: { authorization: 'Bearer tok-123', host: 'gateway.example' },
    ...over,
  };
}

describe('ProxyService.forward', () => {
  it('forwards to the owning service with the path intact and the token carried', async () => {
    const calls: { url: string; init?: { headers?: Record<string, string> } }[] = [];
    const svc = new ProxyService(UPSTREAMS, stubFetch({ body: [{ sku: 'AG-1' }] }, calls));
    const reply = await svc.forward(req());
    expect(reply?.status).toBe(200);
    expect(reply?.body).toEqual([{ sku: 'AG-1' }]);
    expect(calls[0].url).toBe('http://commerce:3001/commerce/catalog');
    expect(calls[0].init?.headers?.authorization).toBe('Bearer tok-123');
    // The per-hop host header is not carried to the new hop.
    expect(calls[0].init?.headers?.host).toBeUndefined();
  });

  it('routes by prefix to a different service', async () => {
    const calls: { url: string }[] = [];
    const svc = new ProxyService(UPSTREAMS, stubFetch({}, calls));
    await svc.forward(req({ originalUrl: '/ads/campaigns?orgId=org-1' }));
    expect(calls[0].url).toBe('http://ads:3007/ads/campaigns?orgId=org-1');
  });

  it('forwards a write body and method unchanged', async () => {
    const calls: { url: string; init?: { method?: string; body?: unknown } }[] = [];
    const svc = new ProxyService(UPSTREAMS, stubFetch({ status: 201, body: { id: 'o1' } }, calls));
    const reply = await svc.forward(
      req({ method: 'POST', originalUrl: '/commerce/orders', body: { lines: [] } }),
    );
    expect(reply?.status).toBe(201);
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.body).toBe('{"lines":[]}');
  });

  it('returns undefined for a path the gateway serves itself', async () => {
    const svc = new ProxyService(UPSTREAMS, stubFetch());
    expect(await svc.forward(req({ originalUrl: '/gateway/bff/home' }))).toBeUndefined();
    expect(await svc.forward(req({ originalUrl: '/health' }))).toBeUndefined();
  });

  it('refuses a request when the service has no configured address', async () => {
    const svc = new ProxyService({ commerce: 'http://commerce:3001' }, stubFetch());
    await expect(svc.forward(req({ originalUrl: '/ads/campaigns' }))).rejects.toBeInstanceOf(UnknownUpstreamError);
  });

  it('passes an upstream error status and body through untouched', async () => {
    const svc = new ProxyService(
      UPSTREAMS,
      stubFetch({ status: 403, body: { statusCode: 403, message: 'missing permission' } }),
    );
    const reply = await svc.forward(req());
    expect(reply?.status).toBe(403);
    expect(reply?.body).toEqual({ statusCode: 403, message: 'missing permission' });
  });

  it('returns no body for a 204', async () => {
    const svc = new ProxyService(UPSTREAMS, stubFetch({ status: 204 }));
    const reply = await svc.forward(req());
    expect(reply?.status).toBe(204);
    expect(reply?.body).toBeUndefined();
  });
});
