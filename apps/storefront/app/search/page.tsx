// Wireframe: docs/wireframes/index.html#sf-search
import Link from 'next/link';
import { ProductCard } from '../../components/ProductCard';
import { ServedAdSlot } from '../../components/FulfilmentTag';
import { adsForSlot } from '../../lib/placements';
import { loadAds, loadSearch } from '../../lib/gateway';

// Search reads the live catalogue, so the page renders per request.
export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? '').trim();
  const [{ data: results, error }, adsA5] = await Promise.all([loadSearch(q), loadAds('A5')]);
  const sponsored = adsForSlot(adsA5, 'A5');

  return (
    <section>
      <h1>Search</h1>
      <div className="row"><span>Query: {q || 'braai'}</span><span>Sort: Relevance</span></div>
      {error && <p className="p" role="alert">{error}</p>}
      {results.didYouMean && <p className="p">Did you mean {results.didYouMean}?</p>}

      <h2>Sponsored results</h2>
      <div className="grid">
        {sponsored.map((ad) => <ServedAdSlot key={ad.creativeId} ad={ad} />)}
      </div>

      <h2>Products</h2>
      <div className="grid">
        {results.items.map((v) => <ProductCard key={v.id} v={v} />)}
      </div>

      <p className="p">Sponsored results are labelled and never mixed into the organic list.</p>
      <p><Link href="/">Back to home</Link></p>
    </section>
  );
}
