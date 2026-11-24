// Wireframe: docs/wireframes/index.html#sf-track
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '../../lib/auth-session';
import { formatRand } from '../../lib/format';
import { loadMyOrders } from '../../lib/gateway';
import { pageMetadata } from '../../lib/seo';
import { orderReference } from '../../lib/track';

// A customer's own orders, so it must never be indexed and must render per request.
export const metadata: Metadata = pageMetadata({
  title: 'Your orders',
  description: 'Track an Amazing Goats delivery.',
  path: '/track',
  noindex: true,
});

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  in_cycle: 'Scheduled',
  packing: 'Packing',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

/**
 * The shopper's order list (T-077 `sf-track`).
 *
 * The account page offers "track an order"; this is where that lands. The wireframe
 * shows a single order, but a returning customer has several, and asking them to
 * remember an id to see one is worse than listing the few we hold.
 *
 * Only the caller's own orders are returned — commerce filters by the session's
 * user id, not by anything the browser sends.
 */
export default async function TrackIndexPage() {
  await requireSession('/track');
  const { data: orders, error } = await loadMyOrders();

  return (
    <section>
      <h1>Your orders</h1>
      {error && <p className="p">{error}</p>}

      {!error && orders.length === 0 && (
        <>
          <p className="p">You have not placed an order yet.</p>
          <Link className="btn" href="/boxes">Start with a box</Link>
        </>
      )}

      {orders.length > 0 && (
        <ul className="grid" style={{ marginTop: 16 }}>
          {orders.map((o) => (
            <li key={o.id} className="card">
              <h2>
                <Link href={`/track/${o.id}`}>Order {orderReference(o.id)}</Link>
              </h2>
              <p className="p">
                {STATUS_LABEL[o.status] ?? o.status} · {formatRand(o.totalIncVatCents)} incl. VAT
              </p>
              <Link href={`/track/${o.id}`}>Track this order</Link>
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginTop: 16 }}><Link href="/account">Back to your account</Link></p>
    </section>
  );
}
