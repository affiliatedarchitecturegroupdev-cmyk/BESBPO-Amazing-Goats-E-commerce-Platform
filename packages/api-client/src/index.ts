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

    // Cart and checkout.
    createOrder: (cart: CartInput) =>
      req<Order>('/commerce/orders', { method: 'POST', body: JSON.stringify(cart) }),
    order: (id: string) => req<Order>(`/commerce/orders/${encodeURIComponent(id)}`),

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
