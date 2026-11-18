import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Trade',
  description: 'Trade accounts for bakeries, caterers and retailers: weekly standing orders, credit terms and early windows.',
  path: '/trade',
});
// Wireframe: docs/wireframes/index.html#sf-trade-entry
export default function TradePage() {
  return (
    <section>
      <h1>Amazing Goats store: trade</h1>
      <p>TODO(agent): build this screen from wireframe <code>sf-trade-entry</code>. Respect RBAC and the fulfilment tags.</p>
    </section>
  );
}
