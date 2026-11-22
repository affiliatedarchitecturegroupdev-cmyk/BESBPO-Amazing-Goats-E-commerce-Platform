import { matchesTaxonomy } from './content.rules';
import type { ContentKind, ContentStatus } from './content.rules';

export interface ContentItem {
  id: string;
  kind: ContentKind;
  slug: string;
  title: string;
  summary?: string;
  bodyMd: string;
  authorUserId?: string;
  status: ContentStatus;
  publishedAt?: string;
  heroImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  taxonomy: string[];
  /** The variants this item is about; the links that make a guide shoppable. */
  variantIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentListQuery {
  kind?: ContentKind;
  taxonomy?: string[];
  /** Public reads are always published; this exists for the staff view. */
  status?: ContentStatus;
  limit?: number;
  offset?: number;
}

export interface ContentStore {
  create(item: ContentItem): Promise<ContentItem>;
  get(id: string): Promise<ContentItem | undefined>;
  getBySlug(slug: string): Promise<ContentItem | undefined>;
  update(item: ContentItem): Promise<ContentItem>;
  list(query: ContentListQuery): Promise<ContentItem[]>;
  /** Slugs already in use, for collision-free generation. */
  slugs(): Promise<string[]>;
}

export class InMemoryContentStore implements ContentStore {
  private readonly rows = new Map<string, ContentItem>();

  async create(item: ContentItem): Promise<ContentItem> {
    this.rows.set(item.id, item);
    return item;
  }

  async get(id: string): Promise<ContentItem | undefined> {
    return this.rows.get(id);
  }

  async getBySlug(slug: string): Promise<ContentItem | undefined> {
    return [...this.rows.values()].find((r) => r.slug === slug);
  }

  async update(item: ContentItem): Promise<ContentItem> {
    this.rows.set(item.id, item);
    return item;
  }

  async list(query: ContentListQuery): Promise<ContentItem[]> {
    const rows = [...this.rows.values()]
      .filter((r) => (query.status ? r.status === query.status : true))
      .filter((r) => (query.kind ? r.kind === query.kind : true))
      .filter((r) => matchesTaxonomy(r.taxonomy, query.taxonomy ?? []))
      .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt));
    const offset = query.offset ?? 0;
    return rows.slice(offset, query.limit ? offset + query.limit : undefined);
  }

  async slugs(): Promise<string[]> {
    return [...this.rows.values()].map((r) => r.slug);
  }
}
