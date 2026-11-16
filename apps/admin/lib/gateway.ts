import { cookies } from 'next/headers';
import {
  ApiError,
  createClient,
  type AdReport,
  type ApiClient,
  type AuditRecord,
  type Batch,
  type CollectionAction,
  type CycleRecord,
  type DeliveryRoute,
  type Invoice,
  type KpiReport,
  type MerchSection,
  type Order,
  type PriceList,
  type Recall,
  type Settlement,
} from '@ag/api-client';

/**
 * The admin portal's door to the platform (docs/01-architecture.md): every
 * screen reads through the gateway on the server, carrying the caller's bearer
 * token from the `ag_token` cookie. The base URL stays out of the browser
 * bundle.
 */
const BASE_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

export const TOKEN_COOKIE = 'ag_token';

export function adminClient(): ApiClient {
  const token = cookies().get(TOKEN_COOKIE)?.value;
  return createClient(BASE_URL, token ? () => ({ authorization: `Bearer ${token}` }) : () => ({}));
}

/** A screen read: the data, or the reason it could not be loaded. */
export interface Loaded<T> {
  data: T;
  error?: string;
}

function message(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return 'You do not have access to this screen.';
    if (err.status === 404) return 'Nothing found.';
  }
  return 'The admin service is having trouble right now. Please try again.';
}

async function load<T>(read: (client: ApiClient) => Promise<T>, fallback: T): Promise<Loaded<T>> {
  try {
    return { data: await read(adminClient()) };
  } catch (err) {
    return { data: fallback, error: message(err) };
  }
}

export const loadOrders = () => load<Order[]>((c) => c.orders(), []);
export const loadCycles = () => load<CycleRecord[]>((c) => c.cycles(), []);
export const loadBatches = () => load<Batch[]>((c) => c.batches(), []);
export const loadRoutes = () => load<DeliveryRoute[]>((c) => c.routes(), []);
export const loadRecalls = () => load<Recall[]>((c) => c.recalls(), []);
export const loadAuditLog = () => load<AuditRecord[]>((c) => c.auditLog(), []);
export const loadInvoices = () => load<Invoice[]>((c) => c.invoices(), []);
export const loadCollections = () => load<CollectionAction[]>((c) => c.collections(), []);
export const loadSettlements = () => load<Settlement[]>((c) => c.settlements(), []);
export const loadPriceLists = () => load<PriceList[]>((c) => c.priceLists(), []);
export const loadMerchandising = () => load<MerchSection[]>((c) => c.merchandising(), []);
export const loadAdReport = () =>
  load<AdReport>((c) => c.adReport(), { impressions: 0, clicks: 0, clickThroughPct: 0 });
export const loadKpis = () =>
  load<KpiReport>(
    (c) => c.kpis(),
    { from_date: '', to_date: '', dso: 0, bad_debt_pct: 0, gross_margin_pct: 0 },
  );
