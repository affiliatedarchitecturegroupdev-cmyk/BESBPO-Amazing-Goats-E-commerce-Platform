import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireSession } from '../../../lib/auth-session';
import { loadLatestOrder } from '../../../lib/gateway';

// Reads the caller's own orders; never cached, never indexed.
export const dynamic = 'force-dynamic';

/**
 * "Track an order" from the account page (T-077).
 *
 * The shortest honest route to the thing the shopper clicked: send them to their
 * most recent order, or to the list when they have none. A redirect rather than a
 * page of its own, so there is one URL for an order and not two.
 */
export default async function TrackLatestPage() {
  await requireSession('/track/latest');
  const { data: order } = await loadLatestOrder();

  if (order) redirect(`/track/${order.id}`);

  return (
    <section>
      <h1>Your orders</h1>
      <p className="p">You have not placed an order yet.</p>
      <Link className="btn" href="/boxes">Start with a box</Link>
    </section>
  );
}
