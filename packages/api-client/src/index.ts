import type {
  Address,
  CreditTier,
  FulfilmentType,
  Money,
  OrderStatus,
  PaymentMethod,
  Temperature,
  Variant,
} from '@ag/shared-types';
import type { ContentListQuery, ContentView, RecipeSummary, RecipeView } from './content';
import { contentListPath, contentPath, recipePath, recipesPath } from './content';
import type {
  AdReport,
  AuditRecord,
  Batch,
  Campaign,
  CampaignInput,
  CollectionAction,
  CycleRecord,
  DeliveryRoute,
  DriverEventInput,
  DriverSyncResult,
  Invoice,
  KpiReport,
  MerchSection,
  PartnerDocument,
  PriceList,
  ProofCaptureInput,
  ProofOfDelivery,
  PurchaseOrder,
  Recall,
  ResolvedPrice,
  Settlement,
  SlaughterSlot,
  WalletSummary,
} from './staff-types';

/**
 * The typed client the storefront, trade portal and staff portals share
 * (docs/01-architecture.md: the gateway is the BFF). It carries no secret of its
 * own: the caller passes a `getHeaders` that supplies the bearer token, and the
 * base URL is a gateway address the caller reads from the environment on the
 * server, never from a `NEXT_PUBLIC_` variable.
 */

/** Raised when the gateway answers with a non-2xx status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`${status} ${path}`);
    this.name = 'ApiError';
  }
}

/** A catalogue row as the gateway returns it (commerce `CatalogueItem`). */
export interface CatalogueItem {
  id: string;
  sku: string;
  productId: string;
  name: string;
  pack: string;
  unit: string;
  fulfilment: FulfilmentType;
  temperature: Temperature;
  channel: Variant['channel'];
  phase: Variant['phase'];
  lineCode: string;
  lineName: string;
  categorySlug: string | null;
  halaalAvailable: boolean;
  active: boolean;
  priceCents?: Money;
}

export interface CatalogueFilters {
  line?: string;
  category?: string;
  fulfilment?: FulfilmentType;
  channel?: Variant['channel'];
  phase?: Variant['phase'];
  temperature?: Temperature;
}

export interface SearchResult {
  query: string;
  didYouMean: string | null;
  count: number;
  items: CatalogueItem[];
}

export interface CycleInfo {
  cutoffAt: string | null;
  tradeLockAt: string | null;
  orderOpen: boolean;
}

/** The area a shopper asks about (T-078). A postal code is the strictest key. */
export interface AreaQuery {
  postalCode?: string;
  suburb?: string;
  /** The goods total, so the zone's free-over threshold can apply. */
  goodsTotalCents?: number;
}

/** What a served area is told. */
export interface ServedAreaCheck {
  served: true;
  zone: { id: number; code: string; name: string };
  /** ISO instant of the next bookable slot, or null when none is scheduled. */
  nextSlot: string | null;
  feeCents: Money;
  /** ISO instant of the public cut-off, from the shared cut-off engine. */
  cutoffAt: string;
  /** The delivery fee already includes VAT, so it is not taxed again. */
  feeIncludesVat: true;
  freeOverApplied: boolean;
}

/** What an unserved area is told, with a way to be notified when that changes. */
export interface UnservedAreaCheck {
  served: false;
  area: string;
  needsArea: boolean;
  waitlist: { available: true };
}

export type AreaCheck = ServedAreaCheck | UnservedAreaCheck;

/** One row of the public delivery table: the fee and the free-over threshold, no geometry. */
export interface PublicZone {
  code: string;
  name: string;
  feeCents: number;
  freeOverCents: number | null;
}

/** The weekday a zone is served on. */
export interface PublicRouteDay {
  dayOfWeek: number;
  day: string;
  zones: string[];
}

/** What `GET /logistics/zones/table` returns for the public delivery page (T-055). */
export interface PublicZoneTable {
  zones: PublicZone[];
  routeDays: PublicRouteDay[];
  feeIncludesVat: true;
}

/** A catalogue row the gateway returns for a merchandising tile (BFF `BffCatalogueItem`). */
export interface MerchCatalogueItem extends CatalogueItem {
  categorySlug: string | null;
  lineName: string;
  halaalAvailable: boolean;
  active: boolean;
}

/** One tile in a resolved merchandising section, with its optional badge. */
export interface ResolvedMerchItem {
  sku: string;
  name: string;
  pack: string;
  badge: string | null;
  item: MerchCatalogueItem;
}

/** A resolved merchandising section, ready to render. */
export interface ResolvedSection {
  code: string;
  title: string;
  page: string;
  items: ResolvedMerchItem[];
}

/** The merchandising sections the gateway resolved for a page. */
export interface MerchandisingResponse {
  view: 'public' | 'trade';
  page: string;
  sections: ResolvedSection[];
}

export interface HomeResponse {
  view: 'public' | 'trade';
  cycle: CycleInfo;
  sections: ResolvedSection[];
}

/** One cart line, as the commerce order endpoint accepts it. */
export interface CartLineInput {
  sku: string;
  qty: number;
  unitPriceExVatCents: number;
  fulfilment: FulfilmentType;
  temperature: Temperature;
}

export interface CartInput {
  lines: CartLineInput[];
  deliveryFeeCents?: number;
  zoneId?: string;
  paymentMethod?: PaymentMethod | 'deposit';
  deliveryAddress?: Address;
}

export interface Order {
  id: string;
  number?: number;
  cycleId?: string | null;
  status: OrderStatus;
  subtotalExVatCents: number;
  deliveryFeeCents?: number;
  vatCents: number;
  totalIncVatCents: number;
  paymentMethod?: string;
  deliveryAddress?: Address;
  createdAt?: string;
  lines?: CartLineInput[];
}

/** The shopper's view of their own order: no owner id, no staff fields. */
export interface MyOrder {
  id: string;
  status: OrderStatus;
  cycleId: string | null;
  lines: OrderLineView[];
  subtotalExVatCents: number;
  deliveryFeeCents: number;
  vatCents: number;
  totalIncVatCents: number;
  deliveryAddress?: Address;
  createdAt: string;
}

/** How often a recurring order runs. */
export type SubscriptionCadence = 'weekly' | 'fortnightly' | 'monthly';

/** The shopper's view of their own subscription: no owner id. */
export interface MySubscription {
  id: string;
  cadence: SubscriptionCadence;
  /** ISO instant of the next run. */
  nextRunAt: string;
  paused: boolean;
  /** Run instants the customer skipped. */
  skipped: string[];
}

/** A line as the tracking page shows it. */
export interface OrderLineView {
  sku: string;
  qty: number;
  unitPriceExVatCents: number;
  fulfilment: FulfilmentType;
  temperature: Temperature;
}

export interface CreditLimit {
  orgId: string;
  tier: CreditTier;
  termsDays: number;
  limitCents: Money;
  status: 'proposed' | 'approved' | 'rejected';
  reasons?: string[];
  ncaReview?: boolean;
}

export interface StatementLine {
  invoiceId: string;
  number: string;
  dueOn: string;
  totalIncVatCents: Money;
  daysOverdue: number;
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
}

export interface Statement {
  orgId: string;
  asOf: string;
  balanceCents: Money;
  lines: StatementLine[];
}

/** A served retail-media ad (services/ads `AdPlacement`). */
export interface ServedAd {
  creativeId: string;
  campaignId: string;
  slot: string;
  sponsored: boolean;
  label: string;
  headline?: string;
  assetUrl: string;
  destinationUrl?: string;
}

export interface ApplicationDocument {
  kind: string;
  filename?: string;
  state?: string;
}

export interface CreditApplicationInput {
  orgId: string;
  businessType: string;
  registrationNumber: string;
  turnoverDeclaredCents: Money;
  estWeeklySpendCents: Money;
  requestedLimitCents: Money;
  requestedTermsDays: number;
  documents: ApplicationDocument[];
  consentGiven: boolean;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

/** The transport the client uses; defaults to the global fetch. */
/** What `GET /gateway/auth/session` reports about the caller (T-058). */
export interface SessionView {
  user: { id: string; roles: string[]; orgId?: string };
  staff: boolean;
  issuedAt: string | null;
  expiresAt: string | null;
  secondsRemaining: number | null;
}

/** What `GET /gateway/auth/me` reports about the caller. */
export interface MeView {
  id: string;
  roles: string[];
  orgId?: string;
  staff: boolean;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function createClient(
  baseUrl: string,
  getHeaders: () => Record<string, string> = () => ({}),
  fetchImpl: FetchLike = fetch,
) {
  async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetchImpl(baseUrl + path, {
      ...init,
      headers: { 'content-type': 'application/json', ...getHeaders(), ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new ApiError(res.status, path);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    // Session (T-058). `loginUrl` is where a portal sends a browser that has no
    // session; the gateway redirects on to the identity provider. `logout` and
    // `refresh` are POSTs the portal's server calls, since the session cookie is
    // httpOnly and only the server can read it.
    loginUrl: (returnTo = '/') =>
      `${baseUrl}/gateway/auth/login${query({ returnTo })}`,
    session: () => req<SessionView>('/gateway/auth/session'),
    me: () => req<MeView>('/gateway/auth/me'),
    logout: () => req<void>('/gateway/auth/logout', { method: 'POST' }),
    refreshSession: () => req<void>('/gateway/auth/refresh', { method: 'POST' }),

    // Catalogue and cycles.
    home: () => req<HomeResponse>('/gateway/bff/home'),
    // The curated, resolved sections for a storefront page (the staff
    // `merchandising()` below reads the raw sections for the admin screens).
    merchandisingPage: (page = 'home') =>
      req<MerchandisingResponse>(`/gateway/bff/merchandising${query({ page })}`),
    catalogue: (filters: CatalogueFilters = {}) =>
      req<CatalogueItem[]>(`/commerce/catalog${query({ ...filters })}`),
    item: (sku: string) => req<CatalogueItem>(`/commerce/catalog/${encodeURIComponent(sku)}`),
    search: (q: string, opts: { limit?: number } = {}) =>
      req<SearchResult>(`/commerce/catalog/search${query({ q, limit: opts.limit })}`),
    currentCycle: (productClass?: string) =>
      req<CycleInfo>(`/commerce/cycles/current${query({ productClass })}`),
    // The waitlist is the newsletter list: consent is the gate, and an address
    // already on it gets the same answer, so asking twice is harmless.
    joinWaitlist: (email: string, source: string) =>
      req<{ status: 'accepted' }>('/notifications/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email, source }),
      }),
    // The delivery-area check: public, so a shopper asks before signing in.
    areaCheck: (area: AreaQuery) =>
      req<AreaCheck>(
        `/logistics/zones/check${query({
          postalCode: area.postalCode,
          suburb: area.suburb,
          goodsTotalCents: area.goodsTotalCents,
        })}`,
      ),

    // The public delivery table: fees per zone and the weekday each is served (T-055).
    zoneTable: () => req<PublicZoneTable>('/logistics/zones/table'),

    // Cart and checkout.
    createOrder: (cart: CartInput) =>
      req<Order>('/commerce/orders', { method: 'POST', body: JSON.stringify(cart) }),
    order: (id: string) => req<Order>(`/commerce/orders/${encodeURIComponent(id)}`),

    // The shopper's own orders (T-077 track). Separate from the staff calls
    // above: these need only a signed-in customer, not `orders:read`.
    myOrders: () => req<MyOrder[]>('/commerce/my-orders'),
    myOrder: (id: string) => req<MyOrder>(`/commerce/my-orders/${encodeURIComponent(id)}`),

    // The shopper's own subscriptions (`/account`, T-056). Same audience rule as
    // the order reads above: signed in, own rows only.
    mySubscriptions: () => req<MySubscription[]>('/commerce/my-subscriptions'),
    mySubscription: (id: string) =>
      req<MySubscription>(`/commerce/my-subscriptions/${encodeURIComponent(id)}`),
    pauseSubscription: (id: string) =>
      req<MySubscription>(`/commerce/my-subscriptions/${encodeURIComponent(id)}/pause`, {
        method: 'POST',
      }),
    resumeSubscription: (id: string) =>
      req<MySubscription>(`/commerce/my-subscriptions/${encodeURIComponent(id)}/resume`, {
        method: 'POST',
      }),

    // Retail media.
    serveAds: (slot: string, context: Record<string, string | number> = {}) =>
      req<ServedAd[]>(`/ads/decisioning/serve${query({ slot, ...context })}`),

    // Trade accounts.
    creditLimits: () => req<CreditLimit[]>('/accounts/credit-limits'),
    creditLimit: (orgId: string) =>
      req<CreditLimit>(`/accounts/credit-limits/${encodeURIComponent(orgId)}`),
    statement: (orgId: string) =>
      req<Statement>(`/accounts/statements/${encodeURIComponent(orgId)}`),
    submitCreditApplication: (body: CreditApplicationInput) =>
      req<{ id: string; status: string }>('/accounts/credit-applications', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    // Staff: orders, cycles and stock (admin portal).
    orders: () => req<Order[]>('/commerce/orders'),
    cycles: () => req<CycleRecord[]>('/commerce/cycles'),
    tickCycles: () => req<unknown>('/commerce/cycles/tick', { method: 'POST' }),
    batches: () => req<Batch[]>('/stock/batches'),
    releaseBatch: (id: string) =>
      req<Batch>(`/stock/batches/${encodeURIComponent(id)}/release`, { method: 'POST' }),
    recalls: () => req<Recall[]>('/stock/recalls'),
    routes: () => req<DeliveryRoute[]>('/logistics/routes'),

    // Staff: identity, access and audit.
    auditLog: (filter: { entity?: string; actor?: string } = {}) =>
      req<AuditRecord[]>(`/identity/audit${query(filter)}`),
    roleChanges: () => req<unknown[]>('/identity/access/role-changes'),
    elevations: () => req<unknown[]>('/identity/access/elevations'),
    requestRoleChange: (body: { subjectId: string; from: string[]; to: string[] }) =>
      req<unknown>('/identity/access/role-changes', { method: 'POST', body: JSON.stringify(body) }),
    requestElevation: (body: { subjectId: string; role: string; reason: string; minutes: number }) =>
      req<unknown>('/identity/access/elevations', { method: 'POST', body: JSON.stringify(body) }),

    // Staff: accounts, payments and pricing.
    invoices: () => req<Invoice[]>('/accounts/invoices'),
    collections: () => req<CollectionAction[]>('/accounts/collections'),
    settlements: () => req<Settlement[]>('/payments/reconciliation'),
    settlementExceptions: () => req<Settlement[]>('/payments/reconciliation/exceptions'),
    priceLists: () => req<PriceList[]>('/commerce/pricing'),
    /** Prices for many SKUs from one list version; the storefront catalogue read. */
    prices: (skus: string[], audience?: string) =>
      req<Record<string, ResolvedPrice>>(
        `/commerce/pricing/prices${query({ skus: skus.join(','), ...(audience ? { audience } : {}) })}`,
      ),
    merchandising: () => req<MerchSection[]>('/commerce/merchandising'),
    adReport: () => req<AdReport>('/ads/reporting'),
    kpis: (range: { from?: string; to?: string; days?: number } = {}) =>
      req<KpiReport>(`/analytics/kpis${query(range)}`),

    // Advertiser portal.
    campaigns: (orgId?: string) => req<Campaign[]>(`/ads/campaigns${query({ orgId })}`),
    createCampaign: (body: CampaignInput) =>
      req<Campaign>('/ads/campaigns', { method: 'POST', body: JSON.stringify(body) }),
    submitCampaign: (id: string) =>
      req<Campaign>(`/ads/campaigns/${encodeURIComponent(id)}/submit`, { method: 'POST' }),
    wallet: (orgId: string) => req<WalletSummary>(`/ads/billing/${encodeURIComponent(orgId)}`),
    topUpWallet: (body: { advertiserOrgId: string; amountCents: number; ref?: string }) =>
      req<{ balanceCents: number }>('/ads/billing/top-up', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    // Partner portal.
    partnerSlots: (orgId?: string) => req<SlaughterSlot[]>(`/partners/slots${query({ orgId })}`),
    confirmPartnerSlot: (id: string, orgId?: string) =>
      req<SlaughterSlot>(`/partners/slots/${encodeURIComponent(id)}/confirm${query({ orgId })}`, {
        method: 'POST',
      }),
    purchaseOrders: (orgId?: string) =>
      req<PurchaseOrder[]>(`/partners/purchase-orders${query({ orgId })}`),
    partnerDocuments: (orgId?: string) =>
      req<PartnerDocument[]>(`/partners/documents${query({ orgId })}`),

    // Driver sync (offline queue replay).
    syncDriverEvents: (events: DriverEventInput[]) =>
      req<DriverSyncResult>('/logistics/driver-sync', {
        method: 'POST',
        body: JSON.stringify({ events }),
      }),

    // Content and recipes (T-071, T-072). Recipes are content of kind `recipe`
    // with a detail row, served from the same service; the storefront reads them
    // through the gateway like every other page.
    content: (query: ContentListQuery = {}) =>
      req<ContentView[]>(contentListPath(query)),
    contentItem: (slug: string) => req<ContentView>(contentPath(slug)),
    recipes: (query: { taxonomy?: string[]; limit?: number; offset?: number } = {}) =>
      req<RecipeSummary[]>(recipesPath(query)),
    recipe: (slug: string) => req<RecipeView>(recipePath(slug)),

    // Proof of delivery: capture at the stop, and read the proof of a stop.
    captureProof: (stopId: string, body: ProofCaptureInput) =>
      req<ProofOfDelivery>(`/logistics/proof-of-delivery/stops/${encodeURIComponent(stopId)}`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    proofForStop: (stopId: string) =>
      req<ProofOfDelivery>(
        `/logistics/proof-of-delivery/stops/${encodeURIComponent(stopId)}`,
      ),
  };
}

export type ApiClient = ReturnType<typeof createClient>;

export * from './view-models';
export * from './staff-types';

export * from './newsletter';
export * from './reviews';
export * from './content';
