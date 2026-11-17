// Wireframe: docs/wireframes/index.html#sf-merch
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductCard } from '../../../components/ProductCard';
import { ServedAdSlot } from '../../../components/FulfilmentTag';
import { CutoffBanner } from '../../../components/CutoffBanner';
import { cutoffMessage } from '../../../lib/fulfilment';
import { adsForSlot } from '../../../lib/placements';
import { getOccasion, bundlesFor } from '../../../lib/occasions';
import { toMerchSections } from '../../../lib/sections';
import { loadAds, loadCatalogue, loadSections } from '../../../lib/gateway';

// The catalogue and the curated sections are live, so render per request.
export const dynamic = 'force-dynamic';

export default async function OccasionPage({ params }: { params: { slug: string } }) {
  const occasion = getOccasion(params.slug);
  if (!occasion) notFound();

  const [{ data: items, error }, sections, adsA4, adsA9] = await Promise.all([
    loadCatalogue(),
    loadSections('home'),
    loadAds('A4'),
    loadAds('A9'),
  ]);

  // The curated sections the editor pinned to this occasion, if any.
  const curated = toMerchSections(sections).filter((s) => s.code.includes(occasion.slug));
  const bundles = bundlesFor(items);

  return (
    <section>
      <h1>{occasion.label}</h1>
      <p className="p">{occasion.blurb}</p>

      <CutoffBanner message={cutoffMessage('cycle')} />
      {error && <p className="p" role="alert">{error}</p>}

      {adsForSlot(adsA4, 'A4').map((ad) => <ServedAdSlot key={ad.creativeId} ad={ad} />)}

      {curated.map((s) => (
        <div key={s.code}>
          <h2>{s.title}</h2>
          <div className="grid">
            {s.cards.map((c) => <ProductCard key={c.item.sku} v={c.item} />)}
          </div>
        </div>
      ))}

      <h2>Bundles</h2>
      <div className="grid">
        {bundles.map((v) => <ProductCard key={v.id} v={v} />)}
      </div>

      <h2>Cooking method</h2>
      <ul className="chips">
        {occasion.cookingMethods.map((m) => <li key={m}>{m}</li>)}
      </ul>

      <h2>Sponsored</h2>
      <div className="grid">
        {adsForSlot(adsA9, 'A9').map((ad) => <ServedAdSlot key={ad.creativeId} ad={ad} />)}
      </div>

      <h2>Recipes</h2>
      {occasion.recipeTitles.map((title) => (
        <article key={title} className="card">
          <h3>{title}</h3>
          <p className="p">A recipe to make the most of your {occasion.label.toLowerCase()} order.</p>
        </article>
      ))}

      <p>
        <Link className="btn" href="/boxes">Build your own box</Link>
      </p>
      <p><Link href="/">Back to home</Link></p>
    </section>
  );
}
