import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { CatalogueFilters, CatalogueItem, SearchOptions, SearchResult } from './catalog.types';
import { applyFilters, didYouMean, rankItems, searchTokens } from './catalog.search';
import { CatalogueStore, InMemoryCatalogueStore, itemsFromMapping } from './catalog.store';
import { mapCatalogue, parseCatalogueCsv } from './catalogue-mapping';

export const CATALOGUE_STORE = Symbol('CATALOGUE_STORE');

/** Walk up from the current directory to the seed CSV, so local runs self-seed. */
export function findCatalogueCsv(start = process.cwd()): string | null {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, 'db/seeds/catalogue_v1.csv');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Load the T-003 seed into an in-memory store, or an empty store if it is absent. */
export function seedCatalogueStore(): InMemoryCatalogueStore {
  const path = findCatalogueCsv();
  if (!path) return new InMemoryCatalogueStore();
  return new InMemoryCatalogueStore(itemsFromMapping(mapCatalogue(parseCatalogueCsv(readFileSync(path, 'utf8')))));
}

@Injectable()
export class CatalogService {
  constructor(@Inject(CATALOGUE_STORE) private readonly store: CatalogueStore) {}

  async list(filters: CatalogueFilters = {}): Promise<CatalogueItem[]> {
    return applyFilters(await this.store.all(), filters).sort((a, b) => a.sku.localeCompare(b.sku));
  }

  async get(sku: string): Promise<CatalogueItem> {
    const item = await this.store.get(sku);
    if (!item) throw new NotFoundException(`unknown sku ${sku}`);
    return item;
  }

  async search(query: string, filters: CatalogueFilters = {}, options: SearchOptions = {}): Promise<SearchResult> {
    const scoped = applyFilters(await this.store.all(), filters);
    const ranked = rankItems(query, scoped, options.minScore ?? 0.62);
    const limit = options.limit ?? 20;
    const vocabulary = scoped.flatMap(searchTokens);
    return {
      query,
      didYouMean: didYouMean(query, vocabulary, options.didYouMeanThreshold ?? 0.6),
      count: ranked.length,
      items: ranked.slice(0, limit),
    };
  }

  async upsert(item: CatalogueItem): Promise<CatalogueItem> {
    return this.store.upsert(item);
  }

  async remove(sku: string): Promise<void> {
    if (!(await this.store.remove(sku))) throw new NotFoundException(`unknown sku ${sku}`);
  }
}
