import { Inject, Injectable } from '@nestjs/common';
import type { Variant } from '@ag/shared-types';
import {
  FetchLike,
  TtlCache,
  Upstreams,
  ViewChannel,
  coerceItems,
  isOrderOpen,
  readUpstreamsFromEnv,
  visibleTo,
} from './upstream';

export const UPSTREAMS = Symbol('UPSTREAMS');
export const FETCH_IMPL = Symbol('FETCH_IMPL');

/** Trade roles see trade-only catalogue lines; everyone else sees the public view. */
const TRADE_ROLES = new Set(['trade_owner', 'trade_buyer', 'trade_accounts']);

export function viewForRoles(roles: readonly string[]): ViewChannel {
  return roles.some((r) => TRADE_ROLES.has(r)) ? 'trade' : 'public';
}

export interface CatalogueResponse {
  view: ViewChannel;
  count: number;
  items: Variant[];
}

export interface HomeResponse {
  view: ViewChannel;
  cycle: { cutoffAt: string | null; tradeLockAt: string | null; orderOpen: boolean };
  sections: { id: string; items: Variant[] }[];
}

export class UpstreamError extends Error {
  constructor(readonly service: string, readonly status: number) {
    super(`upstream ${service} responded ${status}`);
  }
}

const defaultFetch = ((globalThis as { fetch?: unknown }).fetch as FetchLike) ?? (async () => {
  throw new Error('no fetch available');
});

@Injectable()
export class BffService {
  private readonly cache = new TtlCache<unknown>(Number(process.env.BFF_CACHE_MS ?? 5000));

  constructor(
    @Inject(UPSTREAMS) private readonly upstreams: Upstreams = readUpstreamsFromEnv(),
    @Inject(FETCH_IMPL) private readonly fetchImpl: FetchLike = defaultFetch,
  ) {}

  private async get(service: keyof Upstreams, path: string, authorization?: string): Promise<unknown> {
    const base = this.upstreams[service];
    if (!base) throw new UpstreamError(service, 503);
    const key = `${service}${path}|${authorization ? 'auth' : 'anon'}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const headers: Record<string, string> = { accept: 'application/json' };
    if (authorization) headers.authorization = authorization;
    const res = await this.fetchImpl(`${base}${path}`, { headers });
    if (!res.ok) throw new UpstreamError(service, res.status);
    const body = await res.json();
    this.cache.set(key, body);
    return body;
  }

  async catalogue(view: ViewChannel, authorization?: string): Promise<CatalogueResponse> {
    const payload = await this.get('commerce', '/commerce/catalog', authorization);
    const items = coerceItems(payload).filter((v) => visibleTo(v.channel, view));
    return { view, count: items.length, items };
  }

  async home(view: ViewChannel, authorization?: string): Promise<HomeResponse> {
    const [catalogue, cycle] = await Promise.all([
      this.catalogue(view, authorization),
      this.get('commerce', '/commerce/cycles/current', authorization).catch(() => ({})),
    ]);
    const c = cycle as { cutoffAt?: string; tradeLockAt?: string };
    return {
      view,
      cycle: {
        cutoffAt: c.cutoffAt ?? null,
        tradeLockAt: c.tradeLockAt ?? null,
        orderOpen: isOrderOpen(view, c.cutoffAt, c.tradeLockAt, Date.now()),
      },
      sections: [{ id: 'catalogue', items: catalogue.items.slice(0, 12) }],
    };
  }

  /** Merge every service's OpenAPI document into one gateway document. */
  async openapi(): Promise<Record<string, unknown>> {
    const names = Object.keys(this.upstreams) as (keyof Upstreams)[];
    const docs = await Promise.all(
      names.map(async (name) => {
        try {
          return { name, doc: await this.get(name, '/openapi.json') };
        } catch {
          return { name, doc: null };
        }
      }),
    );
    return aggregateOpenApi(docs.filter((d) => d.doc !== null) as { name: string; doc: unknown }[]);
  }
}

/** Combine per-service documents: union of paths, namespaced schemas, one tag per service. */
export function aggregateOpenApi(services: { name: string; doc: unknown }[]): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  const schemas: Record<string, unknown> = {};
  const tags: { name: string; description?: string }[] = [];

  for (const { name, doc } of services) {
    if (typeof doc !== 'object' || doc === null) continue;
    const d = doc as {
      info?: { title?: string };
      paths?: Record<string, unknown>;
      components?: { schemas?: Record<string, unknown> };
    };
    tags.push({ name, ...(d.info?.title ? { description: d.info.title } : {}) });
    for (const [path, ops] of Object.entries(d.paths ?? {})) {
      paths[path] = { ...((paths[path] as object) ?? {}), ...(ops as object) };
    }
    for (const [schema, def] of Object.entries(d.components?.schemas ?? {})) {
      schemas[schema in schemas ? `${name}_${schema}` : schema] = def;
    }
  }

  return {
    openapi: '3.1.0',
    info: { title: 'Amazing Goats gateway', version: '0.1.0' },
    tags,
    paths,
    components: { schemas },
  };
}
