/**
 * Content types shared by the storefront and the staff portal. One model serves
 * blog posts, recipes and buying guides (ADR 0013 §1); `kind` separates them.
 */

export type ContentKind = 'post' | 'recipe' | 'guide';
export type ContentStatus = 'draft' | 'review' | 'published' | 'archived';

export interface ContentView {
  id: string;
  kind: ContentKind;
  slug: string;
  title: string;
  summary?: string;
  /** Rendered, sanitised HTML. The storefront must not render Markdown itself. */
  html: string;
  heroImageUrl?: string;
  taxonomy: string[];
  variantIds: string[];
  status: ContentStatus;
  publishedAt?: string;
  seo: { seoTitle: string; seoDescription: string };
}

export interface ContentListQuery {
  kind?: ContentKind;
  taxonomy?: string[];
  limit?: number;
  offset?: number;
}

export interface ContentWriteInput {
  kind: ContentKind;
  title: string;
  summary?: string;
  bodyMd?: string;
  heroImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  taxonomy?: string[];
  variantIds?: string[];
}

/** Only a person may publish; an agent may move a draft to review. */
export type PublishActor = 'agent' | 'person';

/** One ingredient as the recipe service parsed it out of `jsonb`. */
export interface RecipeIngredient {
  quantity?: string;
  item: string;
  note?: string;
}

export interface RecipeStep {
  text: string;
}

/** A recipe card: what the list page needs, without the ingredient list. */
export interface RecipeSummary {
  slug: string;
  title: string;
  summary?: string;
  heroImageUrl?: string;
  taxonomy: string[];
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  /** Pre-formatted ("1 hr 30 min") so every reader words a duration the same. */
  timeLabel: string;
  publishedAt?: string;
}

/** A full recipe: the card plus the detail a cook needs and the products it
 * uses, so the page can offer add-to-cart next to the ingredient list. */
export interface RecipeView extends RecipeSummary {
  id: string;
  html: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  variantIds: string[];
  seo: { seoTitle: string; seoDescription: string };
}

export function contentListPath(query: ContentListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.kind) params.set('kind', query.kind);
  if (query.taxonomy?.length) params.set('taxonomy', query.taxonomy.join(','));
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));
  const qs = params.toString();
  return qs ? `/commerce/content?${qs}` : '/commerce/content';
}

export function contentPath(slug: string): string {
  return `/commerce/content/${encodeURIComponent(slug)}`;
}

export function publishContentPath(id: string): string {
  return `/commerce/content/${encodeURIComponent(id)}/publish`;
}

/** The published recipe list, optionally narrowed by taxonomy. */
export function recipesPath(query: { taxonomy?: string[]; limit?: number; offset?: number } = {}): string {
  const params = new URLSearchParams();
  if (query.taxonomy?.length) params.set('taxonomy', query.taxonomy.join(','));
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));
  const qs = params.toString();
  return qs ? `/commerce/content/recipes?${qs}` : '/commerce/content/recipes';
}

export function recipePath(slug: string): string {
  return `/commerce/content/recipes/${encodeURIComponent(slug)}`;
}
