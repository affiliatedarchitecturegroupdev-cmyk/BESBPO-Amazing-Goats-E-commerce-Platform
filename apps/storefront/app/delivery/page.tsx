import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Delivery',
  description: 'How Amazing Goats delivers: the weekly cycle, delivery zones and cold-chain handling across KwaZulu-Natal.',
  path: '/delivery',
});
// Wireframe: docs/wireframes/index.html#sf-delivery
export default function DeliveryPage() {
  return (
    <section>
      <h1>Amazing Goats store: delivery</h1>
      <p>TODO(agent): build this screen from wireframe <code>sf-delivery</code>. Respect RBAC and the fulfilment tags.</p>
    </section>
  );
}
