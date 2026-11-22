import { cookies } from 'next/headers';
import { ApiError, createClient, type ApiClient, type CatalogueFilters, type PublicZoneTable, type RecipeSummary, type RecipeView, type ResolvedSection } from '@ag/api-client';
import { toStorefrontItems, type StorefrontItem } from './catalog';
import type { ServedAd } from './placements';

/**
 * The storefront's door to the platform (docs/01-architecture.md): every page
 * reads through the gateway, never a service directly, and never with a secret
 * in the browser bundle. The base URL is a server environment variable, and the
 * caller's bearer token comes from the `ag_token` cookie when a signed-in
 * shopper has one.
 */
const BASE_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

/** Token cookie the gateway sets after sign-in. Read on the server only. */
export const TOKEN_COOKIE = 'ag_token';

export function gatewayClient(): ApiClient {
  const token = cookies().get(TOKEN_COOKIE)?.value;
  return createClient(BASE_URL, token ? () => ({ authorization: `Bearer ${token}` }) : () => ({}));
}

/** A page read: the data, or the reason it could not be loaded. */
export interface Loaded<T> {
  data: T;
  error?: string;
}

function message(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return 'Please sign in to see this.';
    if (err.status === 404) return 'That item is no longer available.';
    return 'The shop is having trouble right now. Please try again.';
  }
  return 'The shop is having trouble right now. Please try again.';
}

/** The catalogue for a category (or all of it), as storefront view models. */
export async function loadCatalogue(filters: CatalogueFilters = {}): Promise<Loaded<StorefrontItem[]>> {
  try {
    const items = await gatewayClient().catalogue(filters);
    return { data: toStorefrontItems(items) };
  } catch (err) {
    return { data: [], error: message(err) };
  }
}

/** One item by SKU, or undefined when the gateway has no such item. */
export async function loadItem(sku: string): Promise<Loaded<StorefrontItem | undefined>> {
  try {
    const items = toStorefrontItems([await gatewayClient().item(sku)]);
    return { data: items[0] };
  } catch (err) {
    return { data: undefined, error: message(err) };
  }
}

/** Search results (the query plus the ranked items). */
export async function loadSearch(
  q: string,
): Promise<Loaded<{ didYouMean: string | null; items: StorefrontItem[] }>> {
  try {
    const result = await gatewayClient().search(q);
    return { data: { didYouMean: result.didYouMean, items: toStorefrontItems(result.items) } };
  } catch (err) {
    return { data: { didYouMean: null, items: [] }, error: message(err) };
  }
}

/** The served ads for one slot. A failed ad read never breaks the page. */
export async function loadAds(slot: string): Promise<ServedAd[]> {
  try {
    return await gatewayClient().serveAds(slot);
  } catch {
    return [];
  }
}

/** The current cycle's cut-off, for the cut-off banner. */
export async function loadCycle(): Promise<{ cutoffAt: string | null; orderOpen: boolean }> {
  try {
    const cycle = await gatewayClient().currentCycle();
    return { cutoffAt: cycle.cutoffAt, orderOpen: cycle.orderOpen };
  } catch {
    return { cutoffAt: null, orderOpen: true };
  }
}

/**
 * The public delivery table: the fee per zone and the weekday each is served
 * (T-055). A failed read yields an empty table, so `/delivery` still renders the
 * cycle and the area checker and only the table is missing.
 */
export async function loadZoneTable(): Promise<Loaded<PublicZoneTable>> {
  const empty: PublicZoneTable = { zones: [], routeDays: [], feeIncludesVat: true };
  try {
    return { data: await gatewayClient().zoneTable() };
  } catch (err) {
    return { data: empty, error: message(err) };
  }
}

/**
 * The resolved merchandising sections for a page, as the gateway's BFF returns
 * them (T-040). A failed read yields no sections, so the page falls back to the
 * catalogue rather than erroring.
 */
export async function loadSections(page = 'home'): Promise<ResolvedSection[]> {
  try {
    const res = await gatewayClient().merchandisingPage(page);
    return res.sections;
  } catch {
    return [];
  }
}

/**
 * The published recipes, for the list page (T-072). A failed read is reported as
 * an error with an empty list, so the page shows "the kitchen is having trouble"
 * rather than an empty state that looks like there are no recipes at all.
 */
export async function loadRecipes(
  query: { taxonomy?: string[]; limit?: number } = {},
): Promise<Loaded<RecipeSummary[]>> {
  try {
    return { data: await gatewayClient().recipes(query) };
  } catch (err) {
    return { data: [], error: message(err) };
  }
}

/**
 * One recipe by slug. A 404 is `undefined` rather than an error, because the
 * detail page answers it with `notFound()` — the shop is fine, the recipe is
 * simply not there — while a network failure is an error the page must show.
 */
export async function loadRecipe(slug: string): Promise<Loaded<RecipeView | undefined>> {
  try {
    return { data: await gatewayClient().recipe(slug) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { data: undefined };
    return { data: undefined, error: message(err) };
  }
}
