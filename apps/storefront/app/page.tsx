// Wireframe: docs/wireframes/index.html#sf-home
import Link from 'next/link';
import { CutoffBanner } from '../components/CutoffBanner';
import { ProductCard } from '../components/ProductCard';
import { ServedAdSlot } from '../components/FulfilmentTag';
import { CATEGORIES, featuredBoxes, ITEMS } from '../lib/catalog';
import { servedAdsForSlot } from '../lib/ads-seed';
import { adsForSlot, placeAds } from '../lib/placements';
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
  const banners = adsForSlot(servedAdsForSlot('A1').concat(servedAdsForSlot('A2')), 'A1');
  const midBand = adsForSlot(servedAdsForSlot('A2'), 'A2');
  // A4 sponsored tiles sit among the specials, one in five, at most two.
  const specialsWithAds = placeAds(specials, servedAdsForSlot('A4'));

  return (
    <section>
      <CutoffBanner message={cutoffMessage('cycle')} />

      {banners.map((ad) => <ServedAdSlot key={ad.creativeId} ad={ad} />)}

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

      {midBand.map((ad) => <ServedAdSlot key={ad.creativeId} ad={ad} />)}

      <h2>Weekly specials</h2>
      <div className="grid">
        {specialsWithAds.map((p, i) => (
          <div key={`${('id' in p.item ? p.item.id : i)}-${i}`}>
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
        {adsForSlot(servedAdsForSlot('A4'), 'A4').map((ad) => <ServedAdSlot key={ad.creativeId} ad={ad} />)}
      </div>

      <h2>Dairy and produce</h2>
      <div className="grid">
        {essentials.map((v) => <ProductCard key={v.id} v={v} />)}
      </div>
    </section>
  );
}
