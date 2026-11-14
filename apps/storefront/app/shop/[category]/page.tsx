// Wireframe: docs/wireframes/index.html#sf-category
import Link from 'next/link';
import { CutoffBanner } from '../../../components/CutoffBanner';
import { ProductCard } from '../../../components/ProductCard';
import { SponsoredSlot } from '../../../components/FulfilmentTag';
import { byCategory, CATEGORIES } from '../../../lib/catalog';
import { cutoffMessage } from '../../../lib/fulfilment';
import { placeSponsored } from '../../../lib/merchandising';

const FILTERS = ['All cuts', 'Boxes', 'Braai', 'Potjie', 'Halaal', 'Pack size'];

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export default function ShopCategoryPage({ params }: { params: { category: string } }) {
  const category = CATEGORIES.find((c) => c.slug === params.category);
  const label = category?.label ?? params.category;
  const items = byCategory(params.category);
  // A3 category sponsor sits above the grid; A4 sponsored tiles sit at positions 3, 7, 11.
  const sponsored = items.length > 0
    ? [{ item: { ...items[0], id: 'sponsored-spice', name: 'Sponsored: spice rub', priceCents: undefined }, slot: 'A4' }]
    : [];
  const placed = placeSponsored(items, sponsored);

  return (
    <section>
      <h1>{label}</h1>
      <SponsoredSlot slot="A3">Category sponsor banner</SponsoredSlot>

      <ul className="chips">
        {FILTERS.map((f) => <li key={f}>{f}</li>)}
      </ul>
      <div className="row"><span>{items.length} products</span><span>Sort: Popular</span></div>

      <CutoffBanner message={cutoffMessage('cycle')} />

      <div className="grid">
        {placed.map((p, i) => (
          <div key={`${p.item.id}-${i}`}>
            {p.sponsored
              ? <SponsoredSlot slot={p.slot!}><ProductCard v={p.item} /></SponsoredSlot>
              : <ProductCard v={p.item} />}
          </div>
        ))}
      </div>

      <p className="p">Badges: Farm direct, Halaal option, Low stock. Max one sponsored tile in five.</p>

      <p><Link href="/">Back to home</Link></p>
    </section>
  );
}
