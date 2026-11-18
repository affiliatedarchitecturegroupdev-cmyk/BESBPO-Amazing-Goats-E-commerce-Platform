import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Account',
  description: 'Your Amazing Goats account.',
  path: '/account',
  noindex: true,
});
// Wireframe: docs/wireframes/index.html#sf-account
export default function AccountPage() {
  return (
    <section>
      <h1>Amazing Goats store: account</h1>
      <p>TODO(agent): build this screen from wireframe <code>sf-account</code>. Respect RBAC and the fulfilment tags.</p>
    </section>
  );
}
