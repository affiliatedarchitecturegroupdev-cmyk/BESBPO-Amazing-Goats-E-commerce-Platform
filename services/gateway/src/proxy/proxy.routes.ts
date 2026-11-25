import type { Upstreams } from '../bff/upstream';

/**
 * The service prefixes the gateway proxies. `packages/api-client` calls these
 * paths on the gateway base URL, so the gateway must forward them to the owning
 * service; without this, every live read from a front end has nowhere to go.
 *
 * The downstream path is unchanged: each service already serves its own prefix
 * (`/commerce/catalog` on the gateway becomes `/commerce/catalog` on commerce),
 * so the proxy is a transparent transport and the owning service stays the only
 * place that decides what a route does and who may reach it.
 */
export interface ProxyPrefix {
  /** The path prefix, e.g. `/commerce`. */
  prefix: string;
  /** The upstream service it belongs to. */
  upstream: keyof Upstreams;
}

/** Longest prefix first, so a more specific entry wins if prefixes ever nest. */
export const PROXY_PREFIXES: readonly ProxyPrefix[] = [
  { prefix: '/commerce', upstream: 'commerce' },
  { prefix: '/stock', upstream: 'stock' },
  { prefix: '/accounts', upstream: 'accounts' },
  { prefix: '/logistics', upstream: 'logistics' },
  { prefix: '/payments', upstream: 'payments' },
  { prefix: '/notifications', upstream: 'notifications' },
  { prefix: '/ads', upstream: 'ads' },
  { prefix: '/partners', upstream: 'partners' },
  { prefix: '/identity', upstream: 'identity' },
  { prefix: '/analytics', upstream: 'analytics' },
];

/** The path with the query string and any trailing slash removed. */
function cleanPath(path: string | undefined): string {
  const p = (path ?? '/').split('?')[0];
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

/**
 * The upstream a request path belongs to, or undefined when the gateway serves
 * it itself (`/gateway/*`, `/health`). A prefix matches the path exactly or as a
 * path segment, so `/commerce` and `/commerce/x` match `/commerce` but
 * `/commercial` does not.
 */
export function proxyTargetFor(path: string | undefined): ProxyPrefix | undefined {
  const p = cleanPath(path);
  return PROXY_PREFIXES.find((entry) => p === entry.prefix || p.startsWith(`${entry.prefix}/`));
}

/**
 * Headers that are per-hop and must not be forwarded. `host` and
 * `content-length` are dropped because the proxy sets them for the new hop;
 * `connection` and the rest are defined as hop-by-hop by RFC 7230.
 */
export const HOP_BY_HOP_HEADERS: readonly string[] = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
];

/**
 * Identity headers a caller might set to impersonate another org. The gateway
 * strips them and lets the owning service re-derive identity from the bearer
 * token, so a client can never widen its own row-level scope through a header.
 */
export const SPOOFABLE_IDENTITY_HEADERS: readonly string[] = [
  'x-ag-user-id',
  'x-ag-org-id',
  'x-ag-staff',
  'x-ag-roles',
];

/** Whether a header name is one the proxy must not forward. */
export function isDroppedHeader(name: string): boolean {
  const lower = name.toLowerCase();
  return HOP_BY_HOP_HEADERS.includes(lower) || SPOOFABLE_IDENTITY_HEADERS.includes(lower);
}

/**
 * The headers to send upstream: the caller's, minus the per-hop and spoofable
 * ones, plus `x-forwarded-*` so the upstream sees the original client. The
 * bearer token is carried through untouched, so the downstream service sets the
 * `app.org_id` / `app.staff` row-level-security session from it.
 */
export function forwardedHeaders(
  headers: Record<string, string | string[] | undefined>,
  hop: { ip?: string; proto?: string } = {},
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || isDroppedHeader(name)) continue;
    out[name] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  if (hop.ip) out['x-forwarded-for'] = hop.ip;
  out['x-forwarded-proto'] = hop.proto ?? out['x-forwarded-proto'] ?? 'https';
  return out;
}

/** Response headers to return to the caller, minus the per-hop ones. */
export function forwardedResponseHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || HOP_BY_HOP_HEADERS.includes(name.toLowerCase())) continue;
    out[name] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return out;
}

/** The absolute upstream URL for a request path, preserving the query string. */
export function proxyUrl(base: string, originalUrl: string): string {
  const path = originalUrl.startsWith('/') ? originalUrl : `/${originalUrl}`;
  return `${base.replace(/\/+$/, '')}${path}`;
}
