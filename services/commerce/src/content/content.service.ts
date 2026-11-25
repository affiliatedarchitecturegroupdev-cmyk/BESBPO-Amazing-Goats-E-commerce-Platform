import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { renderMarkdown } from './markdown';
import {
  type ContentKind,
  type ContentStatus,
  type PublishActor,
  decidePublish,
  isPublished,
  seoFor,
  uniqueSlug,
} from './content.rules';
import type { ContentItem, ContentListQuery, ContentStore } from './content.store';
import {
  type RecipeDetail,
  type RecipeIngredient,
  type RecipeStep,
  formatDuration,
  isRenderableRecipe,
  parseRecipeDetail,
  totalMinutes,
} from './recipe.rules';

export const CONTENT_STORE = Symbol('CONTENT_STORE');

export class ContentNotAllowedError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

export interface CreateContentInput {
  kind: ContentKind;
  title: string;
  summary?: string;
  bodyMd?: string;
  heroImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  taxonomy?: string[];
  variantIds?: string[];
  authorUserId?: string;
  /** Required when `kind` is `recipe`: a recipe without ingredients and steps is
   * not a recipe, and the page has nothing to render. */
  recipe?: RecipeDetail;
}

/** What a reader receives: the stored item plus the rendered body and resolved
 * SEO tags, so the storefront never has to call the renderer itself. */
export interface ContentView extends ContentItem {
  html: string;
  seo: { seoTitle: string; seoDescription: string };
}

/** A recipe as the list page needs it: enough for a card, no ingredient list. */
export interface RecipeSummary {
  slug: string;
  title: string;
  summary?: string;
  heroImageUrl?: string;
  taxonomy: string[];
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  /** "45 min", "1 hr 30 min". Rendered by the service so the page and any other
   * reader agree on the wording. */
  timeLabel: string;
  publishedAt?: string;
}

/** A recipe as the detail page needs it: everything, plus its rendered body. */
export interface RecipeView extends RecipeSummary {
  id: string;
  html: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  /** The variants the recipe is about, so reading converts to buying. */
  variantIds: string[];
  seo: { seoTitle: string; seoDescription: string };
}

@Injectable()
export class ContentService {
  constructor(@Inject(CONTENT_STORE) private readonly store: ContentStore) {}

  /**
   * Authoring. The slug is derived from the title and made collision-safe here,
   * so the database's unique constraint is a backstop rather than the mechanism
   * the caller has to handle.
   */
  async create(
    input: CreateContentInput,
    at: Date = new Date(),
  ): Promise<ContentItem> {
    const when = at.toISOString();
    const slug = uniqueSlug(input.title, await this.store.slugs());
    const item = await this.store.create({
      id: randomUUID(),
      kind: input.kind,
      slug,
      title: input.title,
      summary: input.summary,
      bodyMd: input.bodyMd ?? '',
      authorUserId: input.authorUserId,
      status: 'draft',
      heroImageUrl: input.heroImageUrl,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      taxonomy: input.taxonomy ?? [],
      variantIds: input.variantIds ?? [],
      createdAt: when,
      updatedAt: when,
    });
    if (input.recipe) await this.store.saveRecipeDetail(item.id, input.recipe);
    return item;
  }

  /** A published item is not edited in place — that would change what readers
   * already linked to. Only drafts and items under review are patchable. */
  async patch(
    id: string,
    patch: Partial<CreateContentInput>,
    at: Date = new Date(),
  ): Promise<ContentItem> {
    const item = await this.store.get(id);
    if (!item) throw new NotFoundException('no such content');
    if (isPublished(item.status)) {
      throw new ContentNotAllowedError(
        'a published item is not edited in place; archive it and publish a new one',
      );
    }

    const title = patch.title ?? item.title;
    // A retitled draft gets a fresh slug; keeping the old one would leave the
    // address describing content it no longer is.
    const slug =
      patch.title && patch.title !== item.title
        ? uniqueSlug(title, (await this.store.slugs()).filter((s) => s !== item.slug))
        : item.slug;

    // `recipe` is detail, not a column on the content row; spreading it in would
    // put a stray key on the item every reader then sees.
    const { recipe, ...fields } = patch;
    const updated = await this.store.update({
      ...item,
      ...fields,
      title,
      slug,
      taxonomy: patch.taxonomy ?? item.taxonomy,
      variantIds: patch.variantIds ?? item.variantIds,
      updatedAt: at.toISOString(),
    });
    if (recipe) await this.store.saveRecipeDetail(id, recipe);
    return updated;
  }

  /** The publish workflow. An agent may move a draft to review; only a person
   * may publish (ADR 0013 s1). */
  async publish(
    id: string,
    actor: PublishActor,
    at: Date = new Date(),
  ): Promise<ContentItem> {
    const item = await this.store.get(id);
    if (!item) throw new NotFoundException('no such content');

    const decision = decidePublish(item.status, actor);
    if (!decision.allowed) throw new ContentNotAllowedError(decision.reason);

    const when = at.toISOString();
    return this.store.update({
      ...item,
      status: decision.status as ContentStatus,
      publishedAt: decision.status === 'published' ? when : item.publishedAt,
      updatedAt: when,
    });
  }

  /** Public list: published only, whatever the caller asks for. The `status`
   * field on the query is for staff views and is ignored here. */
  async listPublished(query: {
    kind?: ContentKind;
    taxonomy?: string[];
    limit?: number;
    offset?: number;
  }): Promise<ContentView[]> {
    const items = await this.store.list({ ...query, status: 'published' });
    return items.map((item) => this.view(item));
  }

  /** One published item by slug, or 404. A draft's slug is a 404, not a 403:
   * an unpublished address should not confirm that it exists. */
  async getPublishedBySlug(slug: string): Promise<ContentView> {
    const item = await this.store.getBySlug(slug);
    if (!item || !isPublished(item.status)) throw new NotFoundException('no such content');
    return this.view(item);
  }

  /**
   * Published recipes for the list page. A recipe with no stored detail is
   * omitted rather than shown as a card with no time and no ingredients: a
   * reader who clicks it would reach a page that cannot be cooked, and the list
   * would be advertising something that is not there.
   */
  async listPublishedRecipes(query: { taxonomy?: string[]; limit?: number; offset?: number } = {}) {
    const items = await this.store.list({ ...query, kind: 'recipe', status: 'published' });
    const details = await this.store.recipeDetails(items.map((i) => i.id));
    const out: RecipeSummary[] = [];
    for (const item of items) {
      const detail = details.get(item.id);
      if (!detail || !isRenderableRecipe(detail)) continue;
      out.push(this.summary(item, detail));
    }
    return out;
  }

  /**
   * One published recipe by slug. Three ways this is a 404 rather than a page:
   * the slug is unknown, the item is not published, or it is published but has
   * no cookable detail. The last is the one worth stating — a half-written
   * recipe should read as "not there" to the public, not as an empty shell.
   */
  async getPublishedRecipe(slug: string): Promise<RecipeView> {
    const item = await this.store.getBySlug(slug);
    if (!item || item.kind !== 'recipe' || !isPublished(item.status)) {
      throw new NotFoundException('no such recipe');
    }
    const detail = await this.store.recipeDetail(item.id);
    if (!detail || !isRenderableRecipe(detail)) throw new NotFoundException('no such recipe');

    return {
      ...this.summary(item, detail),
      id: item.id,
      html: renderMarkdown(item.bodyMd),
      ingredients: detail.ingredients,
      steps: detail.steps,
      variantIds: item.variantIds,
      seo: seoFor(item),
    };
  }

  private summary(item: ContentItem, detail: RecipeDetail): RecipeSummary {
    return {
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      heroImageUrl: item.heroImageUrl,
      taxonomy: item.taxonomy,
      servings: detail.servings,
      prepMinutes: detail.prepMinutes,
      cookMinutes: detail.cookMinutes,
      timeLabel: formatDuration(totalMinutes(detail)),
      publishedAt: item.publishedAt,
    };
  }

  private view(item: ContentItem): ContentView {
    return {
      ...item,
      html: renderMarkdown(item.bodyMd),
      seo: seoFor(item),
    };
  }
}
