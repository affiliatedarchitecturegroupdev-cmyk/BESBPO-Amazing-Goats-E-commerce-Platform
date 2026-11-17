// Wireframe: docs/wireframes/index.html#sf-home
import Link from 'next/link';
import { CutoffBanner } from '../components/CutoffBanner';
import { ProductCard } from '../components/ProductCard';
import { ServedAdSlot } from '../components/FulfilmentTag';
import { CATEGORIES, featuredBoxes, specials, type StorefrontItem } from '../lib/catalog';
import { adsForSlot, placeAds } from '../lib/placements';
import { cutoffMessage, earlyWindowMessage } from '../lib/fulfilment';
import { toMerchSections } from '../lib/sections';
import { loadAds, loadCatalogue, loadCycle, loadSections } from '../lib/gateway';

// A live catalogue: render per request rather than at build time.
export const dynamic = 'force-dynamic';

const OCCASIONS = [
  { slug: 'braai-day', label: 'Braai day' },
  { slug: 'ceremony', label: 'Ceremony' },
  { slug: 'eid-and-easter', label: 'Eid and Easter' },
  { slug: 'heritage-day', label: 'Heritage Day' },
];

export default async function HomePage() {
  const [{ data: items, error }, adsA1, adsA2, adsA4, cycle, sections] = await Promise.all([
    loadCatalogue(),
    loadAds('A1'),
    loadAds('A2'),
    loadAds('A4'),
    loadCycle(),
    loadSections('home'),
  ]);

  const banners = adsForSlot(adsA1.concat(adsA2), 'A1');
  const midBand = adsForSlot(adsA2, 'A2');
  // A4 sponsored tiles sit among the specials, one in five, at most two.
  const specialsWithAds = placeAds(specials(items), adsA4);
  const essentials = items.filter((i) => i.category === 'eggs' || i.category === 'dairy');
  // Curated merchandising the editor pinned to the home page (T-040).
  const curated = toMerchSections(sections);

  return (
    <section>
      <CutoffBanner message={cycle.orderOpen ? cutoffMessage('cycle') : 'Ordering is closed for this cycle'} />

      {error && <p className="p" role="alert">{error}</p>}

      {banners.map((ad) => <ServedAdSlot key={ad.creativeId} ad={ad} />)}

      <h2>Shop the range</h2>
      <ul className="chips">
        {CATEGORIES.map((c) => (
          <li key={c.slug}><Link href={`/shop/${c.slug}`}>{c.label}</Link></li>
        ))}
      </ul>

      {curated.map((s) => (
        <div key={s.code}>
          <h2>{s.title}</h2>
          <div className="grid">
            {s.cards.map((c) => <ProductCard key={c.item.sku} v={c.item} />)}
          </div>
        </div>
      ))}

      <h2>Ready-made bundles</h2>
      <div className="grid">
        {featuredBoxes(items).map((v) => <ProductCard key={v.id} v={v} />)}
      </div>

      <h2>Shop by occasion</h2>
      <div className="grid">
        {OCCASIONS.map((o) => (
          <article key={o.slug} className="card"><Link href={`/occasions/${o.slug}`}>{o.label}</Link></article>
        ))}
      </div>

      {midBand.map((ad) => <ServedAdSlot key={ad.creativeId} ad={ad} />)}

      <h2>Weekly specials</h2>
      <div className="grid">
        {specialsWithAds.map((p, i) => (
          <div key={`${(p.item as StorefrontItem).id}-${i}`}>
            {p.ad ? <ServedAdSlot ad={p.ad} /> : <ProductCard v={p.item} />}
          </div>
        ))}
      </div>

      <h2>Bakery and caterers</h2>
      <article className="card">
        <h3>Eggs and dairy for bakeries</h3>
        <p>{earlyWindowMessage()}</p>
        <Link className="btn" href="/trade">Trade</Link>
      </article>

      <h2>Sponsored brands</h2>
      <div className="grid">
        {adsForSlot(adsA4, 'A4').map((ad) => <ServedAdSlot key={ad.creativeId} ad={ad} />)}
      </div>

      <h2>Dairy and produce</h2>
      <div className="grid">
        {essentials.map((v) => <ProductCard key={v.id} v={v} />)}
      </div>
    </section>
  );
}
