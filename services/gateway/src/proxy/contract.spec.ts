import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { PROXY_PREFIXES, proxyTargetFor } from './proxy.routes';

/**
 * Contract test: every path `packages/api-client` calls must be served by the
 * gateway. The client is written against the gateway base URL, so a path it
 * calls with no gateway route (and no proxy prefix) is a live read with nowhere
 * to go. This fails the moment the two drift apart.
 */
const CLIENT = join(process.cwd(), '..', '..', 'packages', 'api-client', 'src', 'index.ts');

/** Paths the gateway serves itself, rather than forwarding to a service. */
const GATEWAY_OWN_PATHS = ['/gateway/auth', '/gateway/bff', '/gateway/rate-limit', '/health'];

/** Every first-argument path a `req<...>('...')` call passes, normalised. */
function clientPaths(): string[] {
  const src = readFileSync(CLIENT, 'utf8');
  const out = new Set<string>();
  const re = /req<[^>]*>\(\s*[`'"]([^`'"]+)/g;
  for (const m of src.matchAll(re)) {
    const raw = m[1].split('${')[0].split('?')[0];
    out.add(raw.length > 1 ? raw.replace(/\/+$/, '') : raw);
  }
  return [...out];
}

/** Whether the gateway reaches a path: it serves it, or a proxy prefix covers it. */
function servedByGateway(path: string): boolean {
  if (GATEWAY_OWN_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return true;
  return proxyTargetFor(path) !== undefined;
}

describe('gateway serves every api-client path', () => {
  const paths = clientPaths();

  it('found the client paths to check', () => {
    expect(paths.length).toBeGreaterThan(20);
    expect(paths).toContain('/commerce/catalog');
    expect(paths).toContain('/accounts/credit-limits');
  });

  it('routes each path to a gateway route or a proxied service', () => {
    const unserved = paths.filter((p) => !servedByGateway(p));
    expect(unserved, `paths the gateway does not serve: ${unserved.join(', ')}`).toEqual([]);
  });

  it('proxies a prefix for every non-gateway path the client calls', () => {
    const prefixes = new Set(PROXY_PREFIXES.map((p) => p.prefix));
    const used = paths
      .filter((p) => !GATEWAY_OWN_PATHS.some((o) => p === o || p.startsWith(`${o}/`)))
      .map((p) => p.split('/')[1])
      .map((seg) => `/${seg}`);
    for (const prefix of new Set(used)) expect(prefixes.has(prefix)).toBe(true);
  });
});
