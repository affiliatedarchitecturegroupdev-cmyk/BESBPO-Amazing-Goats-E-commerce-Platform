import { BadGatewayException, Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { userFromRequest, AuthOptions, AUTH_OPTIONS } from '@ag/nest-auth';
import { isStaff } from '@ag/rbac';
import { FetchLike, Upstreams } from '../bff/upstream';
import { UPSTREAMS } from '../bff/bff.service';
import { clientIp } from '../rate-limit/rate-limit.guard';
import { forwardedHeaders, forwardedResponseHeaders, proxyTargetFor, proxyUrl } from './proxy.routes';

export const PROXY_FETCH = Symbol('AG_PROXY_FETCH');

const defaultFetch = ((globalThis as { fetch?: unknown }).fetch as FetchLike) ?? (async () => {
  throw new Error('no fetch available');
});

/** The shape of an incoming request the proxy reads, and of the reply it writes. */
export interface ProxyRequest {
  method: string;
  originalUrl: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface ProxyReply {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Raised when a request names a service the gateway has no address for. It is a
 * `ServiceUnavailableException` so the caller gets a 503 naming the service
 * rather than Nest's default 500 with a stack trace: at launch, stock, accounts,
 * ads, partners, identity and analytics run as modules of the core services, so
 * their prefixes legitimately have no address yet.
 */
export class UnknownUpstreamError extends ServiceUnavailableException {
  constructor(readonly service: string) {
    super(`no upstream configured for ${service}`);
    this.name = 'UnknownUpstreamError';
  }
}

/** Raised when the owning service could not be reached at all. */
export class UpstreamUnreachableError extends BadGatewayException {
  constructor(readonly service: string, reason?: unknown) {
    super(`upstream ${service} could not be reached`);
    this.name = 'UpstreamUnreachableError';
    if (reason !== undefined) this.cause = reason;
  }
}

/**
 * Forwards a request to the owning service and returns its reply. It is a
 * transport only: the owning service still runs its own auth guard and its own
 * row-level-security session, set from the bearer token this carries through.
 * The gateway's own guards have already run (they are `APP_GUARD`s), so the
 * rate limiter and permission check apply before any forward happens.
 */
@Injectable()
export class ProxyService {
  constructor(
    @Inject(UPSTREAMS) private readonly upstreams: Upstreams,
    @Optional() @Inject(PROXY_FETCH) private readonly fetchImpl: FetchLike = defaultFetch,
    @Optional() @Inject(AUTH_OPTIONS) private readonly authOptions: AuthOptions = {},
  ) {}

  /** Forward a request, or return undefined when no service owns the path. */
  async forward(req: ProxyRequest): Promise<ProxyReply | undefined> {
    const target = proxyTargetFor(req.originalUrl);
    if (!target) return undefined;
    const base = this.upstreams[target.upstream];
    if (!base) throw new UnknownUpstreamError(target.upstream);

    const ip = clientIp(req);
    const headers = forwardedHeaders(req.headers, { ip, proto: forwardedProto(req) });
    const sendBody = req.body !== undefined && req.method !== 'GET' && req.method !== 'HEAD';
    const body = sendBody ? serialise(req.body) : undefined;

    const res = await this.fetchImpl(proxyUrl(base, req.originalUrl), {
      method: req.method,
      headers,
      ...(body !== undefined ? { body } : {}),
    }).catch((err: unknown) => {
      // A connection failure (DNS, refused, timeout) is the gateway's problem to
      // report, not a crash: 502 says "the service behind me is not answering",
      // which is what an operator needs to see in a log.
      throw new UpstreamUnreachableError(target.upstream, err);
    });

    return {
      status: res.status,
      headers: forwardedResponseHeaders(headerObject(res)),
      body: await readBody(res),
    };
  }

  /** The caller the gateway resolved, for the audit trail on a forwarded write. */
  caller(req: ProxyRequest) {
    const user = userFromRequest(req, this.authOptions);
    return user ? { id: user.id, orgId: user.orgId, staff: isStaff(user.roles) } : undefined;
  }
}

function forwardedProto(req: ProxyRequest): string | undefined {
  const v = req.headers['x-forwarded-proto'];
  return Array.isArray(v) ? v[0] : v;
}

/** A JSON body is forwarded as text; a raw (unparsed) body is forwarded as-is. */
function serialise(body: unknown): string | Uint8Array {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return body;
  if (typeof body === 'string') return body;
  return JSON.stringify(body);
}

/** Headers off a fetch response, whether it is a `Headers` or a plain object. */
function headerObject(res: unknown): Record<string, string | string[] | undefined> {
  const r = res as { headers?: unknown };
  const h = r.headers;
  if (!h) return {};
  if (typeof (h as { forEach?: unknown }).forEach === 'function') {
    const out: Record<string, string> = {};
    (h as { forEach: (cb: (value: string, key: string) => void) => void }).forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  return h as Record<string, string | string[] | undefined>;
}

/** The upstream body: parsed JSON when present, otherwise undefined (204/empty). */
async function readBody(res: unknown): Promise<unknown> {
  const r = res as { status?: number; text?: () => Promise<string>; json?: () => Promise<unknown> };
  if (typeof r.text === 'function') {
    const text = await r.text();
    if (text === '') return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  if (typeof r.json === 'function') {
    try {
      return await r.json();
    } catch {
      return undefined;
    }
  }
  return undefined;
}
