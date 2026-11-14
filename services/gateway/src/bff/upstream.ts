import type { Channel, FulfilmentType, Phase, Temperature, Variant } from '@ag/shared-types';

/** The two catalogue views the storefront and trade portal ask for. */
export type ViewChannel = 'public' | 'trade';

/** Minimal transport the gateway needs; the real one wraps global fetch. */
export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface Upstreams {
  commerce: string;
  stock?: string;
  accounts?: string;
  logistics?: string;
  payments?: string;
  notifications?: string;
  ads?: string;
  partners?: string;
  identity?: string;
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
};

/** Upstream base URLs from `<NAME>_URL` env vars, falling back to local ports. */
export function readUpstreamsFromEnv(env: NodeJS.ProcessEnv = process.env): Upstreams {
  const out: Upstreams = { commerce: env.COMMERCE_URL || DEFAULTS.commerce };
  for (const name of ['stock', 'accounts', 'logistics', 'payments', 'notifications', 'ads', 'partners', 'identity'] as const) {
    const key = `${name.toUpperCase()}_URL` as keyof NodeJS.ProcessEnv;
    out[name] = env[key] || DEFAULTS[name];
  }
  return out;
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
