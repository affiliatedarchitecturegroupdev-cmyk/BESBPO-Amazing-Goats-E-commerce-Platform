// Wireframe: docs/wireframes/index.html#sf-recipes
import type { Metadata } from 'next';
import Link from 'next/link';
import { GuestCalculator } from '../../components/GuestCalculator';
import { ProductCard } from '../../components/ProductCard';
import { RecipeCard } from '../../components/RecipeCard';
import { ServedAdSlot } from '../../components/FulfilmentTag';
import { loadAds, loadCatalogue, loadRecipes } from '../../lib/gateway';
import { adsForSlot } from '../../lib/placements';
import { recipeListState } from '../../lib/recipe-pages';
import { CUT_GUIDE, MEAL_PROFILES } from '../../lib/recipes';
import { pageMetadata } from '../../lib/seo';

// Recipes are published from the staff portal and the suggested lines follow the
// catalogue, so the page is read per request rather than baked at build time: a
// new recipe appears without a redeploy.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Recipes and cut guide',
  description:
    'Recipes for braai, potjie and slow-roast lamb, how much meat for your table, and how to cook and store every cut we sell.',
  path: '/recipes',
});

export default async function RecipesPage() {
  const [{ data: recipes, error }, { data: items }, adsA9] = await Promise.all([
    loadRecipes(),
    loadCatalogue(),
    loadAds('A9'),
  ]);
  const state = recipeListState({ recipes, error });

  return (
    <section>
      <h1>Recipes and cut guide</h1>
      <p className="p">
        What to do with what you bought: braai, potjie, slow roast, and how much meat
        your table needs.
      </p>

      {adsForSlot(adsA9, 'A9').map((ad) => <ServedAdSlot key={ad.creativeId} ad={ad} />)}

      {state.kind === 'error' && (
        <p className="p" role="alert">
          {state.message}
        </p>
      )}

      {state.kind === 'empty' && (
        <div className="card">
          <h2>No recipes yet</h2>
          <p className="p">
            Our kitchen has not published a recipe yet. In the meantime, every product
            page tells you how the cut is best cooked, and the{' '}
            <Link href="/boxes">boxes</Link> are built to feed a family for a week.
          </p>
        </div>
      )}

      {state.kind === 'list' && (
        <>
          <h2>From the kitchen</h2>
          <div className="grid">
            {state.recipes.map((recipe) => (
              <RecipeCard key={recipe.slug} recipe={recipe} />
            ))}
          </div>
        </>
      )}

      <GuestCalculator />

      <h2>Meals we plan for</h2>
      <ul className="chips">
        {MEAL_PROFILES.map((meal) => <li key={meal.key}>{meal.label}</li>)}
      </ul>

      <h2>Cut guide</h2>
      <p className="p">Which cut, how to cook, how to store.</p>
      <table className="tbl">
        <caption>Every cut in the catalogue, with its method and its keeping.</caption>
        <thead>
          <tr><th scope="col">Cut</th><th scope="col">How to cook</th><th scope="col">How to store</th></tr>
        </thead>
        <tbody>
          {CUT_GUIDE.map((entry) => (
            <tr key={entry.cut}>
              <th scope="row">{entry.cut}</th>
              <td>{entry.cook}</td>
              <td>{entry.store}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length > 0 && (
        <>
          <h2>Shop the cuts</h2>
          <div className="grid">
            {items.slice(0, 6).map((v) => <ProductCard key={v.id} v={v} />)}
          </div>
        </>
      )}

      <h2>More</h2>
      <ul className="chips">
        <li><Link href="/shop/lamb">Lamb</Link></li>
        <li><Link href="/boxes">Boxes</Link></li>
        <li><Link href="/produce">Dairy and produce</Link></li>
        <li><Link href="/delivery">Delivery areas</Link></li>
      </ul>

      <p><Link href="/">Back to home</Link></p>
    </section>
  );
}
