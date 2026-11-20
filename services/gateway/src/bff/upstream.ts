import type { Channel, FulfilmentType, Phase, Temperature, Variant } from '@ag/shared-types';

/** The two catalogue views the storefront and trade portal ask for. */
export type ViewChannel = 'public' | 'trade';

/** Minimal transport the gateway needs; the real one wraps global fetch. */
export type FetchResponseLike = {
  ok: boolean;
  status: number;
  headers?: unknown;
  text?: () => Promise<string>;
  json: () => Promise<unknown>;
};

export type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | Uint8Array;
    signal?: AbortSignal;
  },
) => Promise<FetchResponseLike>;

export interface Upstreams {
  commerce?: string;
  stock?: string;
  accounts?: string;
  logistics?: string;
  payments?: string;
  notifications?: string;
  ads?: string;
  partners?: string;
  identity?: string;
  analytics?: string;
}

const DEFAULTS: Upstreams = {
  commerce: 'http://localhost:3001',
  stock: 'http://localhost:3002',
  accounts: 'http://localhost:3003',
  logistics: 'http://localhost:3004',
  payments: 'http://localhost:3005',
  notifications: 'http://localhost:3006',
  ads: 'http://localhost:3007',
  partners: 'http://localhost:3008',
  identity: 'http://localhost:3009',
  analytics: 'http://localhost:8000',
};

/** Every upstream name, so the env reader and the deploy contract agree on the set. */
export const UPSTREAM_NAMES = Object.keys(DEFAULTS) as (keyof Upstreams)[];

/**
 * The upstreams a deployed gateway cannot work without. Each one is a service
 * in the launch topology; if its URL is missing in production the gateway would
 * have nowhere to send traffic that the front ends depend on, so it refuses to
 * start rather than serving 500s. The others (stock, accounts, ads, partners,
 * identity, analytics) run as modules of these services at launch, so they may
 * be absent — the proxy answers 503 for them instead.
 */
export const REQUIRED_UPSTREAMS: readonly (keyof Upstreams)[] = [
  'commerce',
  'payments',
  'logistics',
  'notifications',
];

/** The `<NAME>_URL` env var that configures an upstream. */
export function upstreamEnvKey(name: keyof Upstreams): string {
  return `${name.toUpperCase()}_URL`;
}

/**
 * Upstream base URLs from `<NAME>_URL` env vars.
 *
 * The localhost defaults are a development convenience only. In production an
 * unset variable resolves to `undefined`, never to localhost: inside a container
 * `localhost` is the gateway itself, so a missing `COMMERCE_URL` would send
 * every catalogue read back into the gateway and fail as a connection error
 * with no hint of the cause. Leaving it undefined lets the proxy answer a
 * truthful 503 naming the service that is not configured.
 */
export function readUpstreamsFromEnv(env: NodeJS.ProcessEnv = process.env): Upstreams {
  const production = env.NODE_ENV === 'production';
  const out: Upstreams = {};
  for (const name of UPSTREAM_NAMES) {
    out[name] = env[upstreamEnvKey(name)] || (production ? undefined : DEFAULTS[name]);
  }
  return out;
}

/**
 * The required upstreams with no address, so startup can fail loudly. Returns an
 * empty array when the configuration is complete. Only enforced in production:
 * a developer running the gateway against local ports has every default set.
 */
export function missingRequiredUpstreams(
  upstreams: Upstreams,
  env: NodeJS.ProcessEnv = process.env,
): (keyof Upstreams)[] {
  if (env.NODE_ENV !== 'production') return [];
  return REQUIRED_UPSTREAMS.filter((name) => !upstreams[name]);
}

/** Which catalogue channels a viewer may see: public sees public packs, trade sees trade lots. */
export function visibleTo(itemChannel: Channel, view: ViewChannel): boolean {
  if (view === 'public') return itemChannel === 'both' || itemChannel === 'public_only';
  return itemChannel === 'both' || itemChannel === 'trade_only';
}

const FULFILMENTS: FulfilmentType[] = ['in_stock', 'pre_order_cycle', 'reservation', 'quote', 'seasonal_pre_order'];
const TEMPERATURES: Temperature[] = ['live', 'chilled', 'frozen', 'ambient'];
const CHANNELS: Channel[] = ['both', 'public_only', 'trade_only'];

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === 'string' && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

/**
 * Normalise one upstream catalogue record into a Variant. Returns null when the
 * record has no usable SKU, so a malformed upstream row never reaches the client.
 */
export function toCatalogueItem(raw: unknown): Variant | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.sku !== 'string' || r.sku.trim() === '') return null;
  const phase = typeof r.phase === 'number' && r.phase >= 1 && r.phase <= 3 ? (r.phase as Phase) : 1;
  return {
    id: typeof r.id === 'string' ? r.id : r.sku,
    sku: r.sku,
    productId: typeof r.productId === 'string' ? r.productId : '',
    name: typeof r.name === 'string' ? r.name : r.sku,
    pack: typeof r.pack === 'string' ? r.pack : '',
    unit: typeof r.unit === 'string' ? r.unit : 'each',
    fulfilment: pick(r.fulfilment, FULFILMENTS, 'in_stock'),
    temperature: pick(r.temperature, TEMPERATURES, 'ambient'),
    channel: pick(r.channel, CHANNELS, 'both'),
    phase,
    ...(typeof r.priceCents === 'number' ? { priceCents: r.priceCents } : {}),
  };
}

/** Coerce an upstream payload (array or `{items:[...]}`) into clean catalogue items. */
export function coerceItems(payload: unknown): Variant[] {
  const arr = Array.isArray(payload)
    ? payload
    : typeof payload === 'object' && payload !== null && Array.isArray((payload as { items?: unknown }).items)
      ? ((payload as { items: unknown[] }).items)
      : [];
  return arr.map(toCatalogueItem).filter((v): v is Variant => v !== null);
}

/**
 * A catalogue row with the fields the storefront view model needs beyond
 * `Variant` (the commerce `CatalogueItem` carries them; `Variant` does not).
 */
export interface BffCatalogueItem extends Variant {
  categorySlug: string | null;
  lineName: string;
  halaalAvailable: boolean;
  active: boolean;
}

/** Normalise one upstream record into a full catalogue row, or null when it has no SKU. */
export function toBffCatalogueItem(raw: unknown): BffCatalogueItem | null {
  const base = toCatalogueItem(raw);
  if (!base) return null;
  const r = raw as Record<string, unknown>;
  return {
    ...base,
    categorySlug: typeof r.categorySlug === 'string' ? r.categorySlug : null,
    lineName: typeof r.lineName === 'string' ? r.lineName : '',
    halaalAvailable: r.halaalAvailable === true,
    active: r.active !== false,
  };
}

/** Coerce an upstream catalogue payload into full catalogue rows. */
export function coerceBffItems(payload: unknown): BffCatalogueItem[] {
  const arr = Array.isArray(payload)
    ? payload
    : typeof payload === 'object' && payload !== null && Array.isArray((payload as { items?: unknown }).items)
      ? ((payload as { items: unknown[] }).items)
      : [];
  return arr.map(toBffCatalogueItem).filter((v): v is BffCatalogueItem => v !== null);
}

/** One resolved merchandising tile: the catalogue row plus its optional badge. */
export interface ResolvedItemView {
  sku: string;
  name: string;
  pack: string;
  badge: string | null;
  item: BffCatalogueItem;
}

/** A resolved merchandising section, ready to render. */
export interface ResolvedSectionView {
  code: string;
  title: string;
  page: string;
  items: ResolvedItemView[];
}

/** The pages a merchandising section can live on, mirroring the commerce enum. */
export const MERCH_PAGE_NAMES = ['home', 'category', 'shop'] as const;
export type BffMerchPage = (typeof MERCH_PAGE_NAMES)[number];

/** Parse a page name, defaulting to `home` for anything unknown. */
export function merchPageFrom(raw: unknown): BffMerchPage {
  return typeof raw === 'string' && (MERCH_PAGE_NAMES as readonly string[]).includes(raw)
    ? (raw as BffMerchPage)
    : 'home';
}

/** A resolved tile from the commerce merchandising response, or null when unusable. */
export function toResolvedItem(raw: unknown): ResolvedItemView | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const item = toBffCatalogueItem(r.item);
  if (!item) return null;
  return {
    sku: typeof r.sku === 'string' ? r.sku : item.sku,
    name: typeof r.name === 'string' ? r.name : item.name,
    pack: typeof r.pack === 'string' ? r.pack : item.pack,
    badge: typeof r.badge === 'string' ? r.badge : null,
    item,
  };
}

/**
 * Coerce the commerce merchandising response (an array of resolved sections, or
 * `{sections:[...]}`) into render-ready sections. A section with no code, or
 * with every tile unusable, is dropped rather than rendered empty.
 */
export function coerceSections(payload: unknown): ResolvedSectionView[] {
  const arr = Array.isArray(payload)
    ? payload
    : typeof payload === 'object' && payload !== null && Array.isArray((payload as { sections?: unknown }).sections)
      ? ((payload as { sections: unknown[] }).sections)
      : [];
  const out: ResolvedSectionView[] = [];
  for (const raw of arr) {
    if (typeof raw !== 'object' || raw === null) continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.code !== 'string' || r.code === '') continue;
    const items = (Array.isArray(r.items) ? r.items : [])
      .map(toResolvedItem)
      .filter((i): i is ResolvedItemView => i !== null);
    out.push({
      code: r.code,
      title: typeof r.title === 'string' ? r.title : r.code,
      page: typeof r.page === 'string' ? r.page : '',
      items,
    });
  }
  return out;
}

/** Keep only the tiles a view may see, and drop any section left empty. */
export function visibleSections(sections: ResolvedSectionView[], view: ViewChannel): ResolvedSectionView[] {
  return sections
    .map((s) => ({ ...s, items: s.items.filter((i) => visibleTo(i.item.channel, view)) }))
    .filter((s) => s.items.length > 0);
}

/** A tile for a plain catalogue row, used by the fallback section. */
export function toItemView(item: BffCatalogueItem): ResolvedItemView {
  return { sku: item.sku, name: item.name, pack: item.pack, badge: null, item };
}

/** Public orders close at the cut-off; trade orders close at the trade lock. */
export function isOrderOpen(
  view: ViewChannel,
  cutoffAt: string | undefined,
  tradeLockAt: string | undefined,
  now: number,
): boolean {
  const at = view === 'trade' ? tradeLockAt ?? cutoffAt : cutoffAt;
  if (!at) return true;
  const t = Date.parse(at);
  return Number.isFinite(t) ? now < t : true;
}

/** Small in-memory TTL cache for upstream reads (per gateway instance). */
export class TtlCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();
  constructor(private readonly ttlMs: number, private readonly now: () => number = Date.now) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }
}
