import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CATALOGUE_STORE } from '../catalog/catalog.service';
import type { CatalogueStore } from '../catalog/catalog.store';
import type { CatalogueItem } from '../catalog/catalog.types';
import {
  MerchandisingError,
  assertValidSection,
  resolveSection,
  visibleSectionsForPage,
} from './merchandising.rules';
import { MerchandisingStore } from './merchandising.store';
import { MerchItem, MerchPage, MerchSection, ResolvedSection } from './merchandising.types';

export const MERCHANDISING_STORE = Symbol('MERCHANDISING_STORE');

@Injectable()
export class MerchandisingService {
  constructor(
    @Inject(MERCHANDISING_STORE) private readonly store: MerchandisingStore,
    @Inject(CATALOGUE_STORE) private readonly catalogue: CatalogueStore,
  ) {}

  async list(): Promise<MerchSection[]> {
    return (await this.store.sections()).sort((a, b) => a.page.localeCompare(b.page) || a.sort - b.sort || a.code.localeCompare(b.code));
  }

  async get(id: string): Promise<MerchSection> {
    const section = await this.store.getSection(id);
    if (!section) throw new NotFoundException(`unknown merchandising section ${id}`);
    return section;
  }

  /** Create or update a section. */
  async upsert(section: MerchSection): Promise<MerchSection> {
    assertValidSection(section);
    return this.store.saveSection(section);
  }

  /** Replace a section's items wholesale, so the admin screen saves the whole strip. */
  async setItems(sectionId: string, items: MerchItem[]): Promise<MerchItem[]> {
    await this.get(sectionId);
    return this.store.replaceItems(sectionId, items.map((i) => ({ ...i, sectionId })));
  }

  /** The visible, resolved sections for a page at `at`. */
  async forPage(page: MerchPage, at: Date = new Date()): Promise<ResolvedSection[]> {
    const catalogue = await this.catalogueMap();
    return visibleSectionsForPage(await this.store.sections(), await this.store.items(), catalogue, page, at);
  }

  /** One section resolved against the catalogue, regardless of visibility. */
  async resolve(id: string): Promise<ResolvedSection> {
    const section = await this.get(id);
    const catalogue = await this.catalogueMap();
    return resolveSection(section, await this.store.itemsForSection(id), catalogue);
  }

  private async catalogueMap(): Promise<Map<string, CatalogueItem>> {
    const items = await this.catalogue.all();
    return new Map(items.map((item) => [item.sku, item]));
  }
}

export { MerchandisingError };
