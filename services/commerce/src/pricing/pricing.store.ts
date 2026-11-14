import { PriceList, PriceListItem } from './pricing.types';

/** Persistence boundary for price lists; the SQL adapter lands with the store swap. */
export interface PricingStore {
  all(): Promise<PriceList[]>;
  get(id: string): Promise<PriceList | undefined>;
  insert(list: PriceList): Promise<PriceList>;
  replace(list: PriceList): Promise<PriceList>;
}

/** In-memory store used by tests and local runs until the SQL adapter is wired. */
export class InMemoryPricingStore implements PricingStore {
  private readonly byId = new Map<string, PriceList>();

  constructor(seed: PriceList[] = []) {
    for (const list of seed) this.byId.set(list.id, list);
  }

  async all(): Promise<PriceList[]> {
    return [...this.byId.values()];
  }

  async get(id: string): Promise<PriceList | undefined> {
    return this.byId.get(id);
  }

  async insert(list: PriceList): Promise<PriceList> {
    this.byId.set(list.id, list);
    return list;
  }

  async replace(list: PriceList): Promise<PriceList> {
    this.byId.set(list.id, list);
    return list;
  }
}

/**
 * A public list priced from the catalogue, so local runs and the storefront have
 * something to read before the real price lists are imported. Cents, excluding
 * VAT. Live from the epoch so it is always active.
 */
export const DEMO_PUBLIC_LIST: PriceList = {
  id: 'pl_demo_public',
  code: 'public-2026',
  name: 'Public price list 2026',
  audience: 'public',
  validFrom: '2020-01-01T00:00:00.000Z',
  validTo: null,
  status: 'published',
  approvedBy: 'seed',
  publishedAt: '2020-01-01T00:00:00.000Z',
  items: [
    { sku: 'AG-LB-005', priceExVatCents: 27500, unitPriceBasis: 'kg' },
    { sku: 'AG-LB-007', priceExVatCents: 32000, unitPriceBasis: 'kg' },
    { sku: 'AG-CH-001', priceExVatCents: 11500, unitPriceBasis: 'kg' },
    { sku: 'AG-EG-001', priceExVatCents: 4500, unitPriceBasis: 'dozen' },
    { sku: 'AG-LG-001', priceExVatCents: 180000, unitPriceBasis: 'each' },
  ],
};

/** Seed store for local runs; tests build their own. */
export function seedPricingStore(): InMemoryPricingStore {
  return new InMemoryPricingStore([structuredClone(DEMO_PUBLIC_LIST)]);
}

/** Find the item a list carries for a SKU, for the service layer. */
export function itemsOf(list: PriceList): PriceListItem[] {
  return list.items;
}
