// Wireframe: docs/wireframes/index.html#sf-category
import Link from 'next/link';
import { CutoffBanner } from '../../../components/CutoffBanner';
import { ProductCard } from '../../../components/ProductCard';
import { ServedAdSlot } from '../../../components/FulfilmentTag';
import { byCategory, CATEGORIES } from '../../../lib/catalog';
import { servedAdsForSlot } from '../../../lib/ads-seed';
import { adsForSlot, placeAds } from '../../../lib/placements';
import { cutoffMessage } from '../../../lib/fulfilment';

const FILTERS = ['All cuts', 'Boxes', 'Braai', 'Potjie', 'Halaal', 'Pack size'];

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export default function ShopCategoryPage({ params }: { params: { category: string } }) {
  const category = CATEGORIES.find((c) => c.slug === params.category);
  const label = category?.label ?? params.category;
  const items = byCategory(params.category);
  // A3 category sponsor sits above the grid; A4 sponsored tiles sit at positions 3, 7, 11.
  const sponsors = adsForSlot(servedAdsForSlot('A3'), 'A3');
  const placed = placeAds(items, servedAdsForSlot('A4'));

  return (
    <section>
      <h1>{label}</h1>
      {sponsors.map((ad) => <ServedAdSlot key={ad.creativeId} ad={ad} />)}

      <ul className="chips">
        {FILTERS.map((f) => <li key={f}>{f}</li>)}
      </ul>
      <div className="row"><span>{items.length} products</span><span>Sort: Popular</span></div>

      <CutoffBanner message={cutoffMessage('cycle')} />

      <div className="grid">
        {placed.map((p, i) => (
          <div key={`${('id' in p.item ? p.item.id : i)}-${i}`}>
            {p.ad ? <ServedAdSlot ad={p.ad} /> : <ProductCard v={p.item} />}
          </div>
        ))}
      </div>

      <p className="p">Badges: Farm direct, Halaal option, Low stock. Max one sponsored tile in five.</p>

      <p><Link href="/">Back to home</Link></p>
    </section>
  );
}
