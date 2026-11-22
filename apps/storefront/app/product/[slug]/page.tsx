// Wireframe: docs/wireframes/index.html#sf-product
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CutoffBanner } from '../../../components/CutoffBanner';
import { AddToCartButton } from '../../../components/AddToCartButton';
import { FulfilmentTag, Badges, SponsoredSlot } from '../../../components/FulfilmentTag';
import { JsonLd } from '../../../components/JsonLd';
import { ProductCard } from '../../../components/ProductCard';
import { formatRand } from '../../../lib/format';
import { badgesFor, CATEGORIES } from '../../../lib/catalog';
import { breadcrumbJsonLd, productJsonLd, productTrail } from '../../../lib/jsonld';
import { cutoffMessage } from '../../../lib/fulfilment';
import { loadCatalogue } from '../../../lib/gateway';
import { pageMetadata, siteUrl } from '../../../lib/seo';

// The catalogue is live, so the page renders per request.
export const dynamic = 'force-dynamic';

const SLOTS = ['Wed 15 Nov', 'Thu 16 Nov', 'Next week'];

/** Per-product metadata (T-064): the product name and pack, when the item is found. */
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { data: items } = await loadCatalogue();
  const v = items.find((i) => i.id === params.slug || i.sku === params.slug);
  if (!v) {
    return pageMetadata({
      title: 'Product not found',
      description: 'This product is no longer available.',
      path: `/product/${params.slug}`,
      noindex: true,
    });
  }
  return pageMetadata({
    title: v.name,
    description: `${v.name} (${v.pack}) from Amazing Goats — farm-direct and delivered on the weekly cycle.`,
    path: `/product/${params.slug}`,
  });
}

export default async function ProductSlugPage({ params }: { params: { slug: string } }) {
  const { data: items } = await loadCatalogue();
  const v = items.find((i) => i.id === params.slug || i.sku === params.slug);
  if (!v) notFound();
  const related = items.filter((i) => i.category === v.category && i.id !== v.id).slice(0, 3);
  const path = `/product/${params.slug}`;
  const trail = productTrail({ name: v.name, path, categorySlug: v.category }, CATEGORIES);

  // No `aggregateRating`: the storefront has no rating source it can key by SKU
  // (reviews are stored against a variant UUID), and marking up a rating the
  // page does not show is a spam signal. It is added when the read path lands.
  const product = productJsonLd({
    name: v.name,
    sku: v.sku,
    url: `${siteUrl()}${path}`,
    description: `${v.name} (${v.pack}) from Amazing Goats — farm-direct and delivered on the weekly cycle.`,
    category: trail.categoryLabel,
    priceCents: v.priceCents,
    fulfilment: v.fulfilment,
  });

  return (
    <section>
      <JsonLd
        nodes={[
          product,
          breadcrumbJsonLd(trail.crumbs),
        ]}
      />
      <h1>{v.name}</h1>
      <div className="img" aria-label="Gallery: swipe" />

      <div className="chips">
        <FulfilmentTag type={v.fulfilment} />
        <Badges badges={badgesFor(v)} />
      </div>

      <div className="row">
        <strong>{v.priceCents != null ? formatRand(v.priceCents) : 'R ---'}</strong>
        <span>{v.pack} · {v.unit}</span>
      </div>

      <h2>Delivery slot</h2>
      <ul className="chips">
        {SLOTS.map((s) => <li key={s}>{s}</li>)}
      </ul>
      <CutoffBanner message={cutoffMessage('cycle')} />
      <p className="p">Delivered chilled in an insulated branded box.</p>

      <div className="row"><span>Subscribe and save</span><span>Off</span></div>
      {v.priceCents != null && v.fulfilment !== 'quote' ? (
        <AddToCartButton
          item={{ sku: v.sku, name: v.name, fulfilment: v.fulfilment, temperature: v.temperature, priceCents: v.priceCents }}
          redirectTo={`/product/${params.slug}`}
        />
      ) : (
        <p className="p">Price on request — ask us for a quote.</p>
      )}
      <Link className="btn o" href="/trade">Reserve for ceremony (quote)</Link>

      <h2>What is in the box</h2>
      <p>Leg, shoulder, chops, ribs, neck, shanks, potjie, mince.</p>

      <h2>Compliance and traceability</h2>
      <article className="card">
        <h3>Batch L-1108</h3>
        <p>Slaughtered 06 Nov · class A · packed at approved premises · use by shown on pack</p>
        <span className="tag">QR</span>
      </article>

      <h2>Cut guide and storage</h2>
      <p>Keep at 0 to 4°C or freeze on arrival.</p>

      <h2>Frequently bought with</h2>
      <SponsoredSlot slot="A6">
        <div className="grid">
          {related.map((r) => <ProductCard key={r.id} v={r} />)}
        </div>
      </SponsoredSlot>

      <p><Link href={`/shop/${v.category}`}>Back to {v.category}</Link></p>
    </section>
  );
}
