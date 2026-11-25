// Wireframe: docs/wireframes/index.html#sf-track
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '../../../lib/auth-session';
import { formatRand } from '../../../lib/format';
import { loadMyOrder } from '../../../lib/gateway';
import { pageMetadata } from '../../../lib/seo';
import { orderReference, orderTimeline } from '../../../lib/track';

// Tracking carries an order id, so it must never be indexed.
export const metadata: Metadata = pageMetadata({
  title: 'Track your order',
  description: 'Track an Amazing Goats delivery.',
  path: '/track',
  noindex: true,
});

// Reads the session cookie and the caller's own order, so it must render per request.
export const dynamic = 'force-dynamic';

/**
 * One order's status (T-077 `sf-track`).
 *
 * Three things this page must get right:
 *
 * 1. It shows only the caller's own order. That decision is made in commerce,
 *    where the owner id comes from the request session, and a caller who does
 *    not own the order gets the same 404 as one asking for an order that does
 *    not exist. Nothing here decides ownership; it renders what the gateway
 *    returned.
 * 2. It says something true for every status. A cancelled order does not show
 *    four grey chips implying the parcel is still coming (`orderTimeline`).
 * 3. It needs a signed-in shopper, so the guard runs before any data is read.
 */
export default async function TrackOrderidPage({ params }: { params: { orderId: string } }) {
  await requireSession(`/track/${params.orderId}`);
  const { data: order, error } = await loadMyOrder(params.orderId);

  if (error) {
    return (
      <section>
        <h1>Track your order</h1>
        <p className="p">{error}</p>
        <Link className="btn o" href="/account">Back to your account</Link>
      </section>
    );
  }

  // Not found, or not the caller's: both are "no such order" by design.
  if (!order) notFound();

  const timeline = orderTimeline(order.status);
  const placed = new Date(order.createdAt);

  return (
    <section>
      <h1>Order {orderReference(order.id)}</h1>
      <p className="p">
        Placed{' '}
        <time dateTime={order.createdAt}>
          {placed.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
        </time>
        {' · '}
        {formatRand(order.totalIncVatCents)} incl. VAT
      </p>

      {timeline.terminal ? (
        <article className="card" style={{ marginTop: 16 }}>
          <h2>{order.status === 'cancelled' ? 'Cancelled' : 'Refunded'}</h2>
          <p className="p">{timeline.nextAction}</p>
        </article>
      ) : (
        <>
          <h2>Progress</h2>
          <ol className="chips" aria-label="Order progress">
            {timeline.steps.map((s) => (
              <li key={s.step}>
                <span className="tag" data-state={s.state}>
                  {s.state === 'done' ? '✓ ' : s.state === 'active' ? '● ' : ''}
                  {s.label}
                </span>
              </li>
            ))}
          </ol>
          {timeline.nextAction && <p className="p">{timeline.nextAction}</p>}
        </>
      )}

      <h2>What you ordered</h2>
      <ul>
        {order.lines.map((l) => (
          <li key={l.sku} className="row">
            <span>{l.sku} × {l.qty}</span>
            <strong>{formatRand(l.unitPriceExVatCents * l.qty)}</strong>
          </li>
        ))}
      </ul>
      <div className="row"><span>Subtotal (excl. VAT)</span><span>{formatRand(order.subtotalExVatCents)}</span></div>
      <div className="row"><span>VAT</span><span>{formatRand(order.vatCents)}</span></div>
      <div className="row"><span>Delivery</span><span>{formatRand(order.deliveryFeeCents)}</span></div>
      <div className="row"><strong>Total</strong><strong>{formatRand(order.totalIncVatCents)}</strong></div>

      {order.deliveryAddress && (
        <>
          <h2>Delivering to</h2>
          <p className="p">
            {order.deliveryAddress.line1}, {order.deliveryAddress.suburb}, {order.deliveryAddress.city}
          </p>
        </>
      )}

      <p className="p" style={{ marginTop: 16 }}>
        Something wrong with this order?{' '}
        <Link href="/contact">Tell us</Link> and quote {orderReference(order.id)}.
      </p>
      <p><Link href="/account">Back to your account</Link></p>
    </section>
  );
}
