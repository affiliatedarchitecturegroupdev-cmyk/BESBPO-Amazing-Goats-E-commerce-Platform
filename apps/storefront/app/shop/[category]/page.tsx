// Wireframe: docs/wireframes/index.html#sf-category
import Link from 'next/link';
import type { Metadata } from 'next';
import { CutoffBanner } from '../../../components/CutoffBanner';
import { ProductCard } from '../../../components/ProductCard';
import { ServedAdSlot } from '../../../components/FulfilmentTag';
import { CATEGORIES, type StorefrontItem } from '../../../lib/catalog';
import { adsForSlot, placeAds } from '../../../lib/placements';
import { cutoffMessage } from '../../../lib/fulfilment';
import { loadAds, loadCatalogue } from '../../../lib/gateway';
import { pageMetadata } from '../../../lib/seo';

// The catalogue is live, so the page renders per request.
export const dynamic = 'force-dynamic';

/** Per-category metadata (T-064): the label and a description built from it. */
export function generateMetadata({ params }: { params: { category: string } }): Metadata {
  const category = CATEGORIES.find((c) => c.slug === params.category);
  const label = category?.label ?? params.category;
  return pageMetadata({
    title: label,
    description: `Shop ${label.toLowerCase()} from Amazing Goats — farm-direct, ordered on the weekly cycle and delivered across KwaZulu-Natal.`,
    path: `/shop/${params.category}`,
  });
}

const FILTERS = ['All cuts', 'Boxes', 'Braai', 'Potjie', 'Halaal', 'Pack size'];

export default async function ShopCategoryPage({ params }: { params: { category: string } }) {
  const category = CATEGORIES.find((c) => c.slug === params.category);
  const label = category?.label ?? params.category;
  const [{ data: items, error }, adsA3, adsA4] = await Promise.all([
    loadCatalogue({ category: params.category }),
    loadAds('A3'),
    loadAds('A4'),
  ]);
  // A3 category sponsor sits above the grid; A4 sponsored tiles sit at positions 3, 7, 11.
  const sponsors = adsForSlot(adsA3, 'A3');
  const placed = placeAds(items, adsA4);

  return (
    <section>
      <h1>{label}</h1>
      {error && <p className="p" role="alert">{error}</p>}
      {sponsors.map((ad) => <ServedAdSlot key={ad.creativeId} ad={ad} />)}

      <ul className="chips">
        {FILTERS.map((f) => <li key={f}>{f}</li>)}
      </ul>
      <div className="row"><span>{items.length} products</span><span>Sort: Popular</span></div>

      <CutoffBanner message={cutoffMessage('cycle')} />

      <div className="grid">
        {placed.map((p, i) => (
          <div key={`${(p.item as StorefrontItem).id}-${i}`}>
            {p.ad ? <ServedAdSlot ad={p.ad} /> : <ProductCard v={p.item} />}
          </div>
        ))}
      </div>

      <p className="p">Badges: Farm direct, Halaal option, Low stock. Max one sponsored tile in five.</p>

      <p><Link href="/">Back to home</Link></p>
    </section>
  );
}
