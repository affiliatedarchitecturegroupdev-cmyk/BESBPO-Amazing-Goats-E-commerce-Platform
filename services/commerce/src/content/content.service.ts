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
}

/** What a reader receives: the stored item plus the rendered body and resolved
 * SEO tags, so the storefront never has to call the renderer itself. */
export interface ContentView extends ContentItem {
  html: string;
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
    return this.store.create({
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

    return this.store.update({
      ...item,
      ...patch,
      title,
      slug,
      taxonomy: patch.taxonomy ?? item.taxonomy,
      variantIds: patch.variantIds ?? item.variantIds,
      updatedAt: at.toISOString(),
    });
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

  private view(item: ContentItem): ContentView {
    return {
      ...item,
      html: renderMarkdown(item.bodyMd),
      seo: seoFor(item),
    };
  }
}
