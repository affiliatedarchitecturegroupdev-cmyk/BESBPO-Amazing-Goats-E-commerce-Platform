import type { RecipeSummary, RecipeView } from '@ag/api-client';
import type { StorefrontItem } from './catalog';

/**
 * The decisions the recipes pages make, as pure functions (T-072), so the pages
 * stay thin and the states can be tested without a network or a mock.
 *
 * The distinction that matters: an empty list and a failed read are different
 * screens. "No recipes yet" tells the reader the kitchen has published nothing;
 * "we could not load the recipes" tells them to try again. Collapsing the two
 * would show an empty shop when the shop is only unreachable.
 */
export type RecipeListState =
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'list'; recipes: RecipeSummary[] };

export function recipeListState(input: {
  recipes: RecipeSummary[];
  error?: string;
}): RecipeListState {
  if (input.error) return { kind: 'error', message: input.error };
  if (input.recipes.length === 0) return { kind: 'empty' };
  return { kind: 'list', recipes: input.recipes };
}

/**
 * What the recipe detail page does with a read. A 404 is `missing` — the shop is
 * up, the recipe is not there, and the page answers `notFound()`. A transport
 * failure is `error`, which the page shows with a retry hint rather than
 * pretending the recipe never existed.
 */
export type RecipeLoadState =
  | { kind: 'error'; message: string }
  | { kind: 'missing' }
  | { kind: 'ok'; recipe: RecipeView };

export function recipeLoadState(input: {
  recipe?: RecipeView;
  error?: string;
}): RecipeLoadState {
  if (input.error) return { kind: 'error', message: input.error };
  if (!input.recipe) return { kind: 'missing' };
  return { kind: 'ok', recipe: input.recipe };
}

/**
 * The catalogue items a recipe is about, in the order the recipe lists them, so
 * the "shop this recipe" row follows the ingredient order rather than whatever
 * order the catalogue happens to be in.
 *
 * A linked variant that is no longer sellable is dropped: the link is a record
 * of intent, not a promise that the product still exists.
 */
export function recipeProducts(
  recipe: Pick<RecipeView, 'variantIds'>,
  items: StorefrontItem[],
): StorefrontItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const out: StorefrontItem[] = [];
  for (const id of recipe.variantIds) {
    const item = byId.get(id);
    if (item) out.push(item);
  }
  return out;
}
