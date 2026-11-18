import { describe, it, expect } from 'vitest';
import {
  HOP_BY_HOP_HEADERS,
  PROXY_PREFIXES,
  SPOOFABLE_IDENTITY_HEADERS,
  forwardedHeaders,
  forwardedResponseHeaders,
  isDroppedHeader,
  proxyTargetFor,
  proxyUrl,
} from './proxy.routes';

describe('proxyTargetFor', () => {
  it('routes each service prefix to its upstream', () => {
    expect(proxyTargetFor('/commerce/catalog')?.upstream).toBe('commerce');
    expect(proxyTargetFor('/accounts/invoices')?.upstream).toBe('accounts');
    expect(proxyTargetFor('/stock/batches')?.upstream).toBe('stock');
    expect(proxyTargetFor('/logistics/routes')?.upstream).toBe('logistics');
    expect(proxyTargetFor('/ads/campaigns')?.upstream).toBe('ads');
    expect(proxyTargetFor('/identity/audit')?.upstream).toBe('identity');
    expect(proxyTargetFor('/partners/slots')?.upstream).toBe('partners');
    expect(proxyTargetFor('/analytics/kpis')?.upstream).toBe('analytics');
    expect(proxyTargetFor('/payments/reconciliation')?.upstream).toBe('payments');
    expect(proxyTargetFor('/notifications/x')?.upstream).toBe('notifications');
  });

  it('matches a prefix exactly and as a path segment, but not as a word', () => {
    expect(proxyTargetFor('/commerce')?.upstream).toBe('commerce');
    expect(proxyTargetFor('/commerce/')?.upstream).toBe('commerce');
    expect(proxyTargetFor('/commercial')?.upstream).toBeUndefined();
    expect(proxyTargetFor('/commerces')).toBeUndefined();
  });

  it('ignores the query string and trailing slashes', () => {
    expect(proxyTargetFor('/commerce/catalog?line=beef')?.upstream).toBe('commerce');
    expect(proxyTargetFor('/commerce/catalog/')?.upstream).toBe('commerce');
  });

  it('leaves the paths the gateway serves itself alone', () => {
    expect(proxyTargetFor('/health')).toBeUndefined();
    expect(proxyTargetFor('/gateway/bff/home')).toBeUndefined();
    expect(proxyTargetFor('/gateway/auth/me')).toBeUndefined();
    expect(proxyTargetFor('/')).toBeUndefined();
  });
});

describe('header forwarding', () => {
  it('drops per-hop and spoofable headers', () => {
    for (const h of HOP_BY_HOP_HEADERS) expect(isDroppedHeader(h.toUpperCase())).toBe(true);
    for (const h of SPOOFABLE_IDENTITY_HEADERS) expect(isDroppedHeader(h)).toBe(true);
    expect(isDroppedHeader('authorization')).toBe(false);
    expect(isDroppedHeader('content-type')).toBe(false);
  });

  it('carries the bearer token and sets x-forwarded-*', () => {
    const out = forwardedHeaders(
      {
        authorization: 'Bearer tok-123',
        'content-type': 'application/json',
        host: 'gateway.example',
        'content-length': '42',
        'x-ag-org-id': 'org-attacker',
      },
      { ip: '41.0.0.1', proto: 'https' },
    );
    expect(out.authorization).toBe('Bearer tok-123');
    expect(out['content-type']).toBe('application/json');
    expect(out['x-forwarded-for']).toBe('41.0.0.1');
    expect(out['x-forwarded-proto']).toBe('https');
    // The caller cannot set its own org scope or host.
    expect(out.host).toBeUndefined();
    expect(out['content-length']).toBeUndefined();
    expect(out['x-ag-org-id']).toBeUndefined();
  });

  it('joins repeated headers and skips undefined values', () => {
    const out = forwardedHeaders({ 'x-multi': ['a', 'b'], 'x-missing': undefined });
    expect(out['x-multi']).toBe('a, b');
    expect('x-missing' in out).toBe(false);
  });

  it('strips hop-by-hop headers from the response', () => {
    const out = forwardedResponseHeaders({ 'content-type': 'application/json', 'transfer-encoding': 'chunked' });
    expect(out['content-type']).toBe('application/json');
    expect(out['transfer-encoding']).toBeUndefined();
  });
});

describe('proxyUrl', () => {
  it('appends the original path, query and all, to the base', () => {
    expect(proxyUrl('http://commerce:3001', '/commerce/catalog?line=beef')).toBe(
      'http://commerce:3001/commerce/catalog?line=beef',
    );
    expect(proxyUrl('http://commerce:3001/', '/commerce/orders')).toBe('http://commerce:3001/commerce/orders');
  });
});

describe('PROXY_PREFIXES', () => {
  it('names every upstream the api-client calls', () => {
    const upstreams = new Set(PROXY_PREFIXES.map((p) => p.upstream));
    for (const name of ['commerce', 'stock', 'accounts', 'logistics', 'payments', 'notifications', 'ads', 'partners', 'identity', 'analytics']) {
      expect(upstreams.has(name as never)).toBe(true);
    }
  });
});
