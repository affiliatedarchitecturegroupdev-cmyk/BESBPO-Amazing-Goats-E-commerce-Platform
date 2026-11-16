import { MerchItem, MerchSection } from './merchandising.types';

/** Persistence boundary for merchandising; the SQL adapter over catalog.merch_sections/items lands with the store swap. */
export interface MerchandisingStore {
  sections(): Promise<MerchSection[]>;
  getSection(id: string): Promise<MerchSection | undefined>;
  saveSection(section: MerchSection): Promise<MerchSection>;
  items(): Promise<MerchItem[]>;
  itemsForSection(sectionId: string): Promise<MerchItem[]>;
  replaceItems(sectionId: string, items: MerchItem[]): Promise<MerchItem[]>;
}

/** In-memory store used by tests and local runs until the SQL adapter is wired. */
export class InMemoryMerchandisingStore implements MerchandisingStore {
  private readonly sectionsById = new Map<string, MerchSection>();
  private readonly itemsBySection = new Map<string, MerchItem[]>();

  constructor(sections: MerchSection[] = [], items: MerchItem[] = []) {
    for (const section of sections) this.sectionsById.set(section.id, section);
    for (const item of items) {
      const list = this.itemsBySection.get(item.sectionId) ?? [];
      list.push(item);
      this.itemsBySection.set(item.sectionId, list);
    }
  }

  async sections(): Promise<MerchSection[]> {
    return [...this.sectionsById.values()];
  }

  async getSection(id: string): Promise<MerchSection | undefined> {
    return this.sectionsById.get(id);
  }

  async saveSection(section: MerchSection): Promise<MerchSection> {
    this.sectionsById.set(section.id, section);
    return section;
  }

  async items(): Promise<MerchItem[]> {
    return [...this.itemsBySection.values()].flat();
  }

  async itemsForSection(sectionId: string): Promise<MerchItem[]> {
    return [...(this.itemsBySection.get(sectionId) ?? [])];
  }

  async replaceItems(sectionId: string, items: MerchItem[]): Promise<MerchItem[]> {
    this.itemsBySection.set(sectionId, [...items]);
    return items;
  }
}
