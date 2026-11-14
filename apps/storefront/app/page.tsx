// Wireframe: docs/wireframes/index.html#sf-home
import Link from 'next/link';
import { CutoffBanner } from '../components/CutoffBanner';
import { ProductCard } from '../components/ProductCard';
import { SponsoredSlot } from '../components/FulfilmentTag';
import { CATEGORIES, featuredBoxes, ITEMS } from '../lib/catalog';
import { cutoffMessage, earlyWindowMessage } from '../lib/fulfilment';

const OCCASIONS = [
  { slug: 'braai-day', label: 'Braai day' },
  { slug: 'ceremony', label: 'Ceremony' },
  { slug: 'eid-and-easter', label: 'Eid and Easter' },
  { slug: 'heritage-day', label: 'Heritage Day' },
];

export default function HomePage() {
  const specials = ITEMS.filter((i) => i.special);
  const essentials = ITEMS.filter((i) => i.category === 'eggs' || i.category === 'dairy');

  return (
    <section>
      <CutoffBanner message={cutoffMessage('cycle')} />

      <SponsoredSlot slot="A1">Hero carousel: brand banner</SponsoredSlot>

      <h2>Shop the range</h2>
      <ul className="chips">
        {CATEGORIES.map((c) => (
          <li key={c.slug}><Link href={`/shop/${c.slug}`}>{c.label}</Link></li>
        ))}
      </ul>

      <h2>Ready-made bundles</h2>
      <div className="grid">
        {featuredBoxes().map((v) => <ProductCard key={v.id} v={v} />)}
      </div>

      <h2>Shop by occasion</h2>
      <div className="grid">
        {OCCASIONS.map((o) => (
          <article key={o.slug} className="card"><Link href={`/occasions/${o.slug}`}>{o.label}</Link></article>
        ))}
      </div>

      <SponsoredSlot slot="A2">Mid-page band: promotion</SponsoredSlot>

      <h2>Weekly specials</h2>
      <div className="grid">
        {specials.map((v) => <ProductCard key={v.id} v={v} />)}
      </div>

      <h2>Bakery and caterers</h2>
      <article className="card">
        <h3>Eggs and dairy for bakeries</h3>
        <p>{earlyWindowMessage()}</p>
        <Link className="btn" href="/trade">Trade</Link>
      </article>

      <h2>Sponsored brands</h2>
      <div className="grid">
        <SponsoredSlot slot="A4">Charcoal brand</SponsoredSlot>
        <SponsoredSlot slot="A4">Spice brand</SponsoredSlot>
      </div>

      <h2>Dairy and produce</h2>
      <div className="grid">
        {essentials.map((v) => <ProductCard key={v.id} v={v} />)}
      </div>
    </section>
  );
}
