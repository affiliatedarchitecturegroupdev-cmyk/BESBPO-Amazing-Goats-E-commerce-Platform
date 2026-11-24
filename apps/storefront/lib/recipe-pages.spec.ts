import { describe, expect, it } from 'vitest';
import type { RecipeSummary, RecipeView } from '@ag/api-client';
import { toStorefrontItems } from './catalog';
import { FIXTURE_CATALOGUE } from './fixtures';
import { ingredientLine, recipeListState, recipeLoadState, recipeProducts } from './recipe-pages';

const summary = (over: Partial<RecipeSummary> = {}): RecipeSummary => ({
  slug: 'lamb-potjie',
  title: 'Lamb potjie',
  summary: 'A three-hour potjie over coals.',
  taxonomy: ['lamb', 'potjie'],
  servings: 4,
  prepMinutes: 30,
  cookMinutes: 180,
  timeLabel: '3 hr 30 min',
  publishedAt: '2026-11-11T08:00:00.000Z',
  ...over,
});

const recipe = (over: Partial<RecipeView> = {}): RecipeView => ({
  ...summary(),
  id: 'c1',
  html: '<p>Cast iron.</p>',
  ingredients: [{ quantity: '1 kg', item: 'lamb neck' }],
  steps: [{ text: 'Brown the meat.' }],
  variantIds: ['v-full-lamb-box'],
  seo: { seoTitle: 'Lamb potjie recipe', seoDescription: 'How to build a potjie.' },
  ...over,
});

describe('recipeListState', () => {
  it('reports an error rather than an empty list when the read failed', () => {
    expect(recipeListState({ recipes: [], error: 'gateway unavailable' })).toEqual({
      kind: 'error',
      message: 'gateway unavailable',
    });
  });

  it('reports an error even if stale recipes came back with it', () => {
    expect(recipeListState({ recipes: [summary()], error: 'timeout' }).kind).toBe('error');
  });

  it('reports empty when the read succeeded with nothing published', () => {
    expect(recipeListState({ recipes: [] })).toEqual({ kind: 'empty' });
  });

  it('lists the recipes in the order the service returned them', () => {
    const state = recipeListState({
      recipes: [summary({ slug: 'a' }), summary({ slug: 'b' })],
    });
    expect(state.kind).toBe('list');
    if (state.kind !== 'list') throw new Error('unreachable');
    expect(state.recipes.map((r) => r.slug)).toEqual(['a', 'b']);
  });
});

describe('recipeLoadState', () => {
  it('is ok when the recipe came back', () => {
    const state = recipeLoadState({ recipe: recipe() });
    expect(state.kind).toBe('ok');
  });

  it('is missing when the read returned nothing and did not fail', () => {
    expect(recipeLoadState({})).toEqual({ kind: 'missing' });
  });

  it('is an error when the read failed, so the page does not claim 404', () => {
    expect(recipeLoadState({ error: 'gateway unavailable' })).toEqual({
      kind: 'error',
      message: 'gateway unavailable',
    });
  });
});

describe('recipeProducts', () => {
  const items = toStorefrontItems(FIXTURE_CATALOGUE);

  it('returns the linked variants in the order the recipe lists them', () => {
    const products = recipeProducts(
      { variantIds: ['v-eggs-tray', 'v-full-lamb-box'] },
      items,
    );
    expect(products.map((p) => p.id)).toEqual(['v-eggs-tray', 'v-full-lamb-box']);
  });

  it('drops a link to a variant that is no longer in the catalogue', () => {
    const products = recipeProducts(
      { variantIds: ['v-gone', 'v-full-lamb-box'] },
      items,
    );
    expect(products.map((p) => p.id)).toEqual(['v-full-lamb-box']);
  });

  it('is empty when the recipe links no products', () => {
    expect(recipeProducts({ variantIds: [] }, items)).toEqual([]);
  });

  it('does not duplicate a variant linked twice', () => {
    const products = recipeProducts(
      { variantIds: ['v-full-lamb-box', 'v-full-lamb-box'] },
      items,
    );
    expect(products).toHaveLength(1);
  });
});

describe('ingredientLine', () => {
  it('joins quantity, item and note into one line', () => {
    expect(ingredientLine({ quantity: '2 kg', item: 'lamb neck', note: 'bone in' })).toBe(
      '2 kg lamb neck bone in',
    );
  });

  it('omits the parts that are absent', () => {
    expect(ingredientLine({ item: 'salt' })).toBe('salt');
    expect(ingredientLine({ quantity: 'a handful', item: 'parsley' })).toBe('a handful parsley');
  });

  it('states the same ingredient the page renders, not the raw jsonb entry', () => {
    const ingredient = { quantity: '1.5 kg', item: 'lamb shoulder', note: 'boneless' };
    expect(ingredientLine(ingredient)).toContain(ingredient.item);
    expect(ingredientLine(ingredient)).toContain(ingredient.quantity);
  });
});
