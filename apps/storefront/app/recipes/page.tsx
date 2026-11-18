import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Recipes',
  description: 'Recipes for braai, potjie and slow-roast lamb, and how to get the most from every cut.',
  path: '/recipes',
});
// Wireframe: docs/wireframes/index.html#sf-recipes
export default function RecipesPage() {
  return (
    <section>
      <h1>Amazing Goats store: recipes</h1>
      <p>TODO(agent): build this screen from wireframe <code>sf-recipes</code>. Respect RBAC and the fulfilment tags.</p>
    </section>
  );
}
