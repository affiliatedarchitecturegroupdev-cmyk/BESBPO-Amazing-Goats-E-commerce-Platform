import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Dairy and produce',
  description: 'Fresh dairy, eggs and produce from the Ezimbuzini farms, delivered on the weekly cycle.',
  path: '/produce',
});
// Wireframe: docs/wireframes/index.html#sf-produce
export default function ProducePage() {
  return (
    <section>
      <h1>Amazing Goats store: produce</h1>
      <p>TODO(agent): build this screen from wireframe <code>sf-produce</code>. Respect RBAC and the fulfilment tags.</p>
    </section>
  );
}
