// Wireframe: docs/wireframes/index.html#sf-produce
import Link from 'next/link';
import { ProductCard } from '../../components/ProductCard';
import { CutoffBanner } from '../../components/CutoffBanner';
import { FulfilmentTag } from '../../components/FulfilmentTag';
import { cutoffMessage, earlyWindowMessage } from '../../lib/fulfilment';
import { loadCatalogue } from '../../lib/gateway';
import { BAKERY_PROGRAMME, PACKER_NOTE, listedGroups, produceGroups } from '../../lib/produce';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Dairy and produce',
  description: 'Eggs, dairy and produce from the Ezimbuzini farms, delivered on the weekly cycle across KwaZulu-Natal.',
  path: '/produce',
});

// The shelf follows the catalogue, so render per request.
export const dynamic = 'force-dynamic';

export default async function ProducePage() {
  const { data: items, error } = await loadCatalogue();
  const groups = produceGroups(items);
  const listed = listedGroups(groups);

  return (
    <section>
      <h1>Dairy and produce</h1>
      <p className="p">
        Eggs, dairy and produce from the Ezimbuzini farms, packed with the same cold chain as the meat.
      </p>

      <CutoffBanner message={cutoffMessage('cycle')} />
      {error && <p className="p" role="alert">{error}</p>}

      {listed.length === 0 && !error && (
        <p className="p" role="status">
          Nothing on this shelf is listed for sale yet. The eggs and dairy lines are being onboarded with
          our packers; the meat, chicken and boxes are open now.
        </p>
      )}

      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`group-${group.key}`}>
          <h2 id={`group-${group.key}`}>{group.label}</h2>
          {group.listed ? (
            <div className="grid">
              {group.items.map((v) => <ProductCard key={v.id} v={v} />)}
            </div>
          ) : (
            <p className="p">
              Not listed for sale yet. We are onboarding a compliant packer for{' '}
              {group.label.toLowerCase()}, and will list it here when it is ready.
            </p>
          )}
        </section>
      ))}

      <p className="p">{PACKER_NOTE}</p>

      <section className="card" aria-labelledby="bakery">
        <h2 id="bakery">{BAKERY_PROGRAMME.heading}</h2>
        <p className="p">{BAKERY_PROGRAMME.body}</p>
        <FulfilmentTag type="pre_order_cycle" />
        <p className="p">{earlyWindowMessage()}</p>
        <Link className="btn" href={BAKERY_PROGRAMME.href}>{BAKERY_PROGRAMME.cta}</Link>
      </section>

      <h2>More from the farm</h2>
      <ul className="chips">
        <li><Link href="/shop/lamb">Lamb</Link></li>
        <li><Link href="/boxes">Boxes</Link></li>
        <li><Link href="/delivery">Delivery areas</Link></li>
        <li><Link href="/recipes">Recipes and cuts</Link></li>
      </ul>

      <p><Link href="/">Back to home</Link></p>
    </section>
  );
}
