/**
 * Content rules: slugs, the publish workflow and SEO fallbacks, as pure
 * functions. The publish workflow is the interesting one, because it encodes a
 * policy that is not obvious from the states alone (ADR 0013 s1).
 */

export type ContentKind = 'post' | 'recipe' | 'guide';
export type ContentStatus = 'draft' | 'review' | 'published' | 'archived';

export const CONTENT_KINDS: ContentKind[] = ['post', 'recipe', 'guide'];

/**
 * A deterministic slug from the title. Deterministic matters: the same title must
 * always produce the same slug, so a retried request does not create a second
 * row under a different address.
 *
 * South African titles include characters a naive slug drops — "Pietermaritzburg's
 * best lamb" keeps the words, "Braai & boerewors" becomes `braai-boerewors`
 * rather than `braai--boerewors`.
 */
export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    // Strip combining marks so "café" becomes "cafe" rather than "caf".
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/**
 * A collision-safe slug: the base slug, then `-2`, `-3` and so on for as long as
 * the candidate is taken. Callers pass the slugs already in use, so this stays
 * pure and the database's unique constraint is the backstop rather than the
 * mechanism.
 */
export function uniqueSlug(title: string, taken: Iterable<string>): string {
  const base = slugify(title) || 'untitled';
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; n < 10000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error(`cannot find a free slug for ${base}`);
}

export type PublishActor = 'agent' | 'person';

export type PublishDecision =
  | { allowed: true; status: ContentStatus }
  | { allowed: false; reason: string };

/**
 * The publish workflow. An agent may move `draft -> review`; only a person may
 * move `review -> published` (ADR 0013 s1).
 *
 * The reason is not bureaucratic: publishing is the moment content becomes
 * public advertising under R146 of 2010, and an automated system must not be the
 * thing that makes that decision. A person's name is on it.
 */
export function decidePublish(
  from: ContentStatus,
  actor: PublishActor,
): PublishDecision {
  if (from === 'published') {
    return { allowed: false, reason: 'already published' };
  }
  if (from === 'archived') {
    return { allowed: false, reason: 'an archived item cannot be published; restore it first' };
  }

  if (from === 'draft') {
    // Both may submit for review; only a person may go straight to published.
    if (actor === 'agent') return { allowed: true, status: 'review' };
    return { allowed: true, status: 'published' };
  }

  // from === 'review'
  if (actor === 'agent') {
    return {
      allowed: false,
      reason: 'only a person may publish; an agent may move a draft to review',
    };
  }
  return { allowed: true, status: 'published' };
}

/**
 * SEO tags fall back to the title and summary rather than rendering empty
 * `<title></title>` tags. An empty meta description is worse than a reused
 * summary: the search engine invents its own snippet, and the page loses the
 * one chance to say what it is about.
 */
export interface Seo {
  seoTitle: string;
  seoDescription: string;
}

export function seoFor(item: {
  title: string;
  summary?: string;
  seoTitle?: string;
  seoDescription?: string;
}): Seo {
  const title = item.seoTitle?.trim() || item.title.trim();
  const description = item.seoDescription?.trim() || item.summary?.trim() || item.title.trim();
  return { seoTitle: title, seoDescription: description };
}

/** Whether an item appears publicly. Only `published`. */
export function isPublished(status: ContentStatus): boolean {
  return status === 'published';
}

/**
 * The taxonomy filter is an "any of these" match, because a recipe tagged
 * `["lamb","winter"]` should appear under both. Comparison is case-insensitive
 * and ignores surrounding space, so an editor typing `Lamb ` does not create a
 * second tag.
 */
export function matchesTaxonomy(itemTaxonomy: string[], wanted: string[]): boolean {
  if (wanted.length === 0) return true;
  const have = new Set(itemTaxonomy.map((t) => t.trim().toLowerCase()));
  return wanted.some((w) => have.has(w.trim().toLowerCase()));
}
