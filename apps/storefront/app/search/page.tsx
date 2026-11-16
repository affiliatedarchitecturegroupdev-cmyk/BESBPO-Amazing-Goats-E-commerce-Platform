// Wireframe: docs/wireframes/index.html#sf-search
import Link from 'next/link';
import { ProductCard } from '../../components/ProductCard';
import { ServedAdSlot } from '../../components/FulfilmentTag';
import { ITEMS } from '../../lib/catalog';
import { servedAdsForSlot } from '../../lib/ads-seed';
import { adsForSlot } from '../../lib/placements';

export default function SearchPage() {
  const sponsored = adsForSlot(servedAdsForSlot('A5'), 'A5');
  const results = ITEMS.filter((i) => i.special);

  return (
    <section>
      <h1>Search</h1>
      <div className="row"><span>Query: braai</span><span>Sort: Relevance</span></div>

      <h2>Sponsored results</h2>
      <div className="grid">
        {sponsored.map((ad) => <ServedAdSlot key={ad.creativeId} ad={ad} />)}
      </div>

      <h2>Products</h2>
      <div className="grid">
        {results.map((v) => <ProductCard key={v.id} v={v} />)}
      </div>

      <p className="p">Sponsored results are labelled and never mixed into the organic list.</p>
      <p><Link href="/">Back to home</Link></p>
    </section>
  );
}
