// Wireframe: docs/wireframes/index.html#sf-merch
import Link from 'next/link';
import { ProductCard } from '../../components/ProductCard';
import { CutoffBanner } from '../../components/CutoffBanner';
import { cutoffMessage } from '../../lib/fulfilment';
import { isBoxItem } from '../../lib/catalog';
import { loadCatalogue } from '../../lib/gateway';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Boxes',
  description: 'Ready-made boxes of lamb, chicken and more, cut and packed to order on the weekly cycle.',
  path: '/boxes',
});

// The box line is live, so render per request.
export const dynamic = 'force-dynamic';

export default async function BoxesPage() {
  const { data: items, error } = await loadCatalogue();
  const boxes = items.filter(isBoxItem);

  return (
    <section>
      <h1>Boxes</h1>
      <p className="p">Ready-made bundles, cut and packed to order on the weekly cycle.</p>

      <CutoffBanner message={cutoffMessage('cycle')} />
      {error && <p className="p" role="alert">{error}</p>}

      {boxes.length === 0 && !error && <p className="p">No boxes are available right now.</p>}

      <div className="grid">
        {boxes.map((v) => <ProductCard key={v.id} v={v} />)}
      </div>

      <h2>Shop by occasion</h2>
      <ul className="chips">
        <li><Link href="/occasions/braai-day">Braai day</Link></li>
        <li><Link href="/occasions/ceremony">Ceremony</Link></li>
        <li><Link href="/occasions/eid-and-easter">Eid and Easter</Link></li>
        <li><Link href="/occasions/heritage-day">Heritage Day</Link></li>
      </ul>

      <p><Link href="/">Back to home</Link></p>
    </section>
  );
}
