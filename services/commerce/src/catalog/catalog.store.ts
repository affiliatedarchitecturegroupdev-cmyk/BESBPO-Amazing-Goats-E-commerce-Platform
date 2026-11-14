import { CatalogueMapping } from './catalogue-mapping';
import { CatalogueItem } from './catalog.types';

/** Persistence boundary for the catalogue; the DB adapter lands with T-008's store swap. */
export interface CatalogueStore {
  all(): Promise<CatalogueItem[]>;
  get(sku: string): Promise<CatalogueItem | undefined>;
  upsert(item: CatalogueItem): Promise<CatalogueItem>;
  remove(sku: string): Promise<boolean>;
}

/** In-memory store used by tests and local runs until the SQL adapter is wired. */
export class InMemoryCatalogueStore implements CatalogueStore {
  private readonly bySku = new Map<string, CatalogueItem>();

  constructor(seed: CatalogueItem[] = []) {
    for (const item of seed) this.bySku.set(item.sku, item);
  }

  async all(): Promise<CatalogueItem[]> {
    return [...this.bySku.values()];
  }

  async get(sku: string): Promise<CatalogueItem | undefined> {
    return this.bySku.get(sku);
  }

  async upsert(item: CatalogueItem): Promise<CatalogueItem> {
    this.bySku.set(item.sku, item);
    return item;
  }

  async remove(sku: string): Promise<boolean> {
    return this.bySku.delete(sku);
  }
}

/** Build catalogue items from the T-003 CSV mapping, joining products to their lines. */
export function itemsFromMapping(mapping: CatalogueMapping): CatalogueItem[] {
  const lines = new Map(mapping.lines.map((l) => [l.code, l]));
  const products = new Map(mapping.products.map((p) => [p.slug, p]));

  return mapping.variants.flatMap((variant) => {
    const product = products.get(variant.productSlug);
    if (!product) return [];
    const line = lines.get(product.lineCode);
    return [{
      id: variant.sku,
      sku: variant.sku,
      productId: product.slug,
      name: product.name,
      pack: variant.pack,
      unit: variant.unit,
      fulfilment: variant.fulfilment,
      temperature: variant.temperature,
      channel: variant.channel,
      phase: variant.phase,
      lineCode: product.lineCode,
      lineName: line?.name ?? product.lineCode,
      categorySlug: null,
      halaalAvailable: product.halaalAvailable,
      active: true,
    }];
  });
}
