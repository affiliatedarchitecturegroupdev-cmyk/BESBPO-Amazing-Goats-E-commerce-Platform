import { matchesTaxonomy } from './content.rules';
import type { ContentKind, ContentStatus } from './content.rules';
import type { RecipeDetail } from './recipe.rules';

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

  /** The recipe detail for a content row, if it has one. A `post` or `guide`
   * has none, so `undefined` is the ordinary answer rather than an error. */
  recipeDetail(contentId: string): Promise<RecipeDetail | undefined>;
  /** Details for a page of recipes in one read, so the list page does not issue
   * a query per card. Ids with no detail are simply absent from the map. */
  recipeDetails(contentIds: string[]): Promise<Map<string, RecipeDetail>>;
  /** Attach or replace a recipe's detail. Only a `recipe` kind carries one. */
  saveRecipeDetail(contentId: string, detail: RecipeDetail): Promise<RecipeDetail>;
}

export class InMemoryContentStore implements ContentStore {
  private readonly rows = new Map<string, ContentItem>();
  private readonly recipes = new Map<string, RecipeDetail>();

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

  async recipeDetail(contentId: string): Promise<RecipeDetail | undefined> {
    return this.recipes.get(contentId);
  }

  async recipeDetails(contentIds: string[]): Promise<Map<string, RecipeDetail>> {
    const found = new Map<string, RecipeDetail>();
    for (const id of contentIds) {
      const detail = this.recipes.get(id);
      if (detail) found.set(id, detail);
    }
    return found;
  }

  async saveRecipeDetail(contentId: string, detail: RecipeDetail): Promise<RecipeDetail> {
    this.recipes.set(contentId, detail);
    return detail;
  }
}
