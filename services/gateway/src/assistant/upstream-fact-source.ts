import { Inject, Injectable } from '@nestjs/common';
import { FETCH_IMPL, UPSTREAMS } from '../bff/bff.service';
import type { FetchLike, Upstreams } from '../bff/upstream';
import type { CatalogueRow, ContentRow, CycleRow, ZoneRow } from './assistant.facts';
import type { FactSource } from './assistant.service';

/**
 * Read facts from the services the BFF already proxies (ADR 0013 s4: the
 * assistant has no privileged path to data). Each read tolerates an upstream
 * failure by returning nothing, so one service being down narrows the answers
 * rather than breaking the assistant.
 */
@Injectable()
export class UpstreamFactSource implements FactSource {
  constructor(
    @Inject(UPSTREAMS) private readonly upstreams: Upstreams,
    @Inject(FETCH_IMPL) private readonly fetchImpl: FetchLike,
  ) {}

  private async get(
    service: keyof Upstreams,
    path: string,
    authorization?: string,
  ): Promise<unknown> {
    const base = this.upstreams[service];
    if (!base) return undefined;
    const headers: Record<string, string> = { accept: 'application/json' };
    if (authorization) headers.authorization = authorization;
    try {
      const res = await this.fetchImpl(`${base}${path}`, { headers });
      if (!res.ok) return undefined;
      return await res.json();
    } catch {
      return undefined;
    }
  }

  async catalogue(authorization?: string): Promise<CatalogueRow[]> {
    const payload = await this.get('commerce', '/commerce/catalog', authorization);
    const rows = asArray(payload, 'items');
    return rows.map(toCatalogueRow).filter((r): r is CatalogueRow => r !== null);
  }

  async cycle(authorization?: string): Promise<CycleRow | undefined> {
    const payload = await this.get('commerce', '/commerce/cycles/current', authorization);
    if (typeof payload !== 'object' || payload === null) return undefined;
    const r = payload as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' ? v : null);
    return {
      cutoffAt: str(r.cutoffAt),
      tradeLockAt: str(r.tradeLockAt),
      deliveryFrom: str(r.deliveryFrom),
      deliveryTo: str(r.deliveryTo),
    };
  }

  async zones(authorization?: string): Promise<ZoneRow[]> {
    const payload = await this.get('logistics', '/logistics/zones', authorization);
    return asArray(payload, 'items').map(toZoneRow).filter((z): z is ZoneRow => z !== null);
  }

  async content(authorization?: string): Promise<ContentRow[]> {
    const payload = await this.get('commerce', '/commerce/content', authorization);
    return asArray(payload, 'items').map(toContentRow).filter((c): c is ContentRow => c !== null);
  }
}

/** An upstream list, whether it arrives bare or wrapped in `{items:[...]}`. */
function asArray(payload: unknown, key: string): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (typeof payload === 'object' && payload !== null) {
    const wrapped = (payload as Record<string, unknown>)[key];
    if (Array.isArray(wrapped)) return wrapped;
  }
  return [];
}

/** Normalise a commerce catalogue row; a row with no SKU is unusable. */
export function toCatalogueRow(raw: unknown): CatalogueRow | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.sku !== 'string' || r.sku.trim() === '') return null;
  return {
    sku: r.sku,
    name: typeof r.name === 'string' ? r.name : r.sku,
    pack: typeof r.pack === 'string' ? r.pack : '',
    categorySlug: typeof r.categorySlug === 'string' ? r.categorySlug : null,
    fulfilment: typeof r.fulfilment === 'string' ? r.fulfilment : 'in_stock',
    temperature: typeof r.temperature === 'string' ? r.temperature : 'ambient',
    halaalAvailable: r.halaalAvailable === true,
    ...(typeof r.priceCents === 'number' ? { priceCents: r.priceCents } : {}),
  };
}

/** Normalise a logistics zone row. */
export function toZoneRow(raw: unknown): ZoneRow | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.code !== 'string' || r.code === '') return null;
  return {
    code: r.code,
    ...(typeof r.name === 'string' ? { name: r.name } : {}),
    ...(typeof r.feeCents === 'number' ? { feeCents: r.feeCents } : {}),
    ...(typeof r.minOrderCents === 'number' ? { minOrderCents: r.minOrderCents } : {}),
    ...(Array.isArray(r.days) ? { days: r.days.filter((d): d is string => typeof d === 'string') } : {}),
  };
}

/** Normalise a commerce content row; a row with no slug is unusable. */
export function toContentRow(raw: unknown): ContentRow | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.slug !== 'string' || r.slug === '') return null;
  return {
    slug: r.slug,
    kind: typeof r.kind === 'string' ? r.kind : 'post',
    title: typeof r.title === 'string' ? r.title : r.slug,
    ...(typeof r.summary === 'string' ? { summary: r.summary } : {}),
    ...(typeof r.html === 'string' ? { html: r.html } : {}),
  };
}
