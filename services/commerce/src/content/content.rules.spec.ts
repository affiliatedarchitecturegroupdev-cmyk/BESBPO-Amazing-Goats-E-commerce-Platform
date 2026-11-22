import { describe, it, expect } from 'vitest';
import {
  decidePublish,
  isPublished,
  matchesTaxonomy,
  seoFor,
  slugify,
  uniqueSlug,
} from './content.rules';

describe('slugify', () => {
  it('is deterministic for the same title', () => {
    expect(slugify('How to cook goat curry')).toBe(slugify('How to cook goat curry'));
    expect(slugify('How to cook goat curry')).toBe('how-to-cook-goat-curry');
  });

  it('collapses punctuation and repeated separators', () => {
    expect(slugify('Braai & boerewors!')).toBe('braai-boerewors');
    expect(slugify('Lamb --- Durban')).toBe('lamb-durban');
  });

  it('drops apostrophes rather than turning them into separators', () => {
    expect(slugify("Pietermaritzburg's best lamb")).toBe('pietermaritzburgs-best-lamb');
  });

  it('strips accents', () => {
    expect(slugify('Café crème')).toBe('cafe-creme');
  });

  it('trims leading and trailing separators', () => {
    expect(slugify('  --Hello--  ')).toBe('hello');
  });

  it('caps the length and does not end on a separator', () => {
    const slug = slugify('a'.repeat(100));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('uniqueSlug', () => {
  it('uses the base slug when it is free', () => {
    expect(uniqueSlug('Goat curry', [])).toBe('goat-curry');
  });

  it('suffixes on collision', () => {
    expect(uniqueSlug('Goat curry', ['goat-curry'])).toBe('goat-curry-2');
    expect(uniqueSlug('Goat curry', ['goat-curry', 'goat-curry-2'])).toBe('goat-curry-3');
  });

  it('falls back to "untitled" when the title has no slug-able characters', () => {
    expect(uniqueSlug('!!!', [])).toBe('untitled');
    expect(uniqueSlug('!!!', ['untitled'])).toBe('untitled-2');
  });
});

describe('decidePublish', () => {
  it('lets an agent move a draft to review only', () => {
    expect(decidePublish('draft', 'agent')).toEqual({ allowed: true, status: 'review' });
  });

  it('refuses an agent publishing from review', () => {
    const decision = decidePublish('review', 'agent');
    expect(decision.allowed).toBe(false);
    expect(decision).toEqual({
      allowed: false,
      reason: 'only a person may publish; an agent may move a draft to review',
    });
  });

  it('lets a person publish from review', () => {
    expect(decidePublish('review', 'person')).toEqual({ allowed: true, status: 'published' });
  });

  it('lets a person publish a draft directly', () => {
    expect(decidePublish('draft', 'person')).toEqual({ allowed: true, status: 'published' });
  });

  it('refuses republishing and publishing an archived item', () => {
    expect(decidePublish('published', 'person').allowed).toBe(false);
    expect(decidePublish('archived', 'person').allowed).toBe(false);
  });
});

describe('seoFor', () => {
  it('prefers explicit SEO values', () => {
    expect(
      seoFor({ title: 'T', summary: 'S', seoTitle: 'SEO T', seoDescription: 'SEO D' }),
    ).toEqual({ seoTitle: 'SEO T', seoDescription: 'SEO D' });
  });

  it('falls back to the title and summary rather than rendering empty tags', () => {
    expect(seoFor({ title: 'Where to buy lamb', summary: 'A Durban guide' })).toEqual({
      seoTitle: 'Where to buy lamb',
      seoDescription: 'A Durban guide',
    });
  });

  it('falls back to the title for the description when there is no summary', () => {
    expect(seoFor({ title: 'Lamb in Durban' }).seoDescription).toBe('Lamb in Durban');
  });

  it('treats a blank explicit value as absent', () => {
    expect(seoFor({ title: 'T', summary: 'S', seoTitle: '   ' }).seoTitle).toBe('T');
  });
});

describe('isPublished', () => {
  it('is true only for published', () => {
    expect(isPublished('published')).toBe(true);
    expect(isPublished('draft')).toBe(false);
    expect(isPublished('review')).toBe(false);
    expect(isPublished('archived')).toBe(false);
  });
});

describe('matchesTaxonomy', () => {
  it('matches when no filter is given', () => {
    expect(matchesTaxonomy(['lamb'], [])).toBe(true);
  });

  it('matches any of the wanted tags', () => {
    expect(matchesTaxonomy(['lamb', 'winter'], ['winter'])).toBe(true);
    expect(matchesTaxonomy(['lamb', 'winter'], ['beef', 'winter'])).toBe(true);
  });

  it('does not match a tag the item lacks', () => {
    expect(matchesTaxonomy(['lamb'], ['beef'])).toBe(false);
  });

  it('ignores case and surrounding space, so a stray space is not a second tag', () => {
    expect(matchesTaxonomy(['Lamb '], ['lamb'])).toBe(true);
  });
});
