// Wireframe: docs/wireframes/index.html#sf-track
import type { Metadata } from 'next';
import { pageMetadata } from '../../../lib/seo';

// Tracking carries an order id, so it must never be indexed.
export const metadata: Metadata = pageMetadata({
  title: 'Track your order',
  description: 'Track an Amazing Goats delivery.',
  path: '/track',
  noindex: true,
});

export default function TrackOrderidPage() {
  return (
    <section>
      <h1>Amazing Goats store: track/[orderId]</h1>
      <p>TODO(agent): build this screen from wireframe <code>sf-track</code>. Respect RBAC and the fulfilment tags.</p>
    </section>
  );
}
