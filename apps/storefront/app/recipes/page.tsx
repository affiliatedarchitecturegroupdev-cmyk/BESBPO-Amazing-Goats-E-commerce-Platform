// Wireframe: docs/wireframes/index.html#sf-recipes
import Link from 'next/link';
import { GuestCalculator } from '../../components/GuestCalculator';
import { ProductCard } from '../../components/ProductCard';
import { ServedAdSlot } from '../../components/FulfilmentTag';
import { loadAds, loadCatalogue } from '../../lib/gateway';
import { adsForSlot } from '../../lib/placements';
import { CUT_GUIDE, MEAL_PROFILES } from '../../lib/recipes';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Recipes and cut guide',
  description: 'How much meat for your table, and how to cook and store every cut of lamb and goat.',
  path: '/recipes',
});

// The suggested lines follow the catalogue, so render per request.
export const dynamic = 'force-dynamic';

export default async function RecipesPage() {
  const [{ data: items }, adsA9] = await Promise.all([loadCatalogue(), loadAds('A9')]);

  return (
    <section>
      <h1>Recipes and cut guide</h1>
      <p className="p">
        How much meat for your table, and how to cook and store every cut we sell.
      </p>

      <GuestCalculator />

      {adsForSlot(adsA9, 'A9').map((ad) => <ServedAdSlot key={ad.creativeId} ad={ad} />)}

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
