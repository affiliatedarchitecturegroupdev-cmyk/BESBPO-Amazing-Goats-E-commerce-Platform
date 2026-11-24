// Wireframe: docs/wireframes/index.html#sf-recipes
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '../../../components/JsonLd';
import { ProductCard } from '../../../components/ProductCard';
import { loadCatalogue, loadRecipe } from '../../../lib/gateway';
import { breadcrumbJsonLd, recipeJsonLd } from '../../../lib/jsonld';
import { ingredientLine, recipeLoadState, recipeProducts } from '../../../lib/recipe-pages';
import { pageMetadata, siteUrl } from '../../../lib/seo';

// Published from the staff portal, so the recipe is read per request.
export const dynamic = 'force-dynamic';

/** Per-recipe metadata (T-064): the recipe's own title and summary, from the
 * content item, not a generic store title. */
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const { data: recipe } = await loadRecipe(params.slug);
  if (!recipe) {
    return pageMetadata({
      title: 'Recipe not found',
      description: 'This recipe is no longer available.',
      path: `/recipes/${params.slug}`,
      noindex: true,
    });
  }
  return pageMetadata({
    title: recipe.seo.seoTitle,
    description: recipe.seo.seoDescription,
    path: `/recipes/${recipe.slug}`,
  });
}

export default async function RecipePage({ params }: { params: { slug: string } }) {
  const [{ data: recipe, error }, { data: items }] = await Promise.all([
    loadRecipe(params.slug),
    loadCatalogue(),
  ]);
  const state = recipeLoadState({ recipe, error });

  if (state.kind === 'error') {
    return (
      <section>
        <h1>Recipe</h1>
        <p className="p" role="alert">
          {state.message}
        </p>
        <p>
          <Link href="/recipes">Back to recipes</Link>
        </p>
      </section>
    );
  }

  if (state.kind === 'missing') notFound();

  const { recipe: found } = state;
  const products = recipeProducts(found, items);
  const path = `/recipes/${found.slug}`;

  const recipeNode = recipeJsonLd({
    name: found.title,
    url: `${siteUrl()}${path}`,
    description: found.summary,
    imageUrl: found.heroImageUrl,
    servings: found.servings,
    prepMinutes: found.prepMinutes,
    cookMinutes: found.cookMinutes,
    ingredients: found.ingredients.map(ingredientLine),
    steps: found.steps.map((step) => step.text),
    datePublished: found.publishedAt,
  });

  return (
    <article>
      <JsonLd
        nodes={[
          recipeNode,
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Recipes', path: '/recipes' },
            { name: found.title, path },
          ]),
        ]}
      />

      <nav>
        <Link href="/recipes">Recipes</Link>
      </nav>

      <h1>{found.title}</h1>
      {found.summary && <p className="p">{found.summary}</p>}

      {found.heroImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={found.heroImageUrl} alt={found.title} width={960} height={540} />
      )}

      <dl className="recipe-facts">
        <div>
          <dt>Time</dt>
          <dd>{found.timeLabel}</dd>
        </div>
        <div>
          <dt>Serves</dt>
          <dd>{found.servings}</dd>
        </div>
        <div>
          <dt>Prep</dt>
          <dd>{found.prepMinutes} min</dd>
        </div>
        <div>
          <dt>Cook</dt>
          <dd>{found.cookMinutes} min</dd>
        </div>
      </dl>

      <section>
        <h2>Ingredients</h2>
        <ul>
          {found.ingredients.map((ingredient, i) => (
            <li key={`${ingredient.item}-${i}`}>
              {ingredient.quantity && <strong>{ingredient.quantity} </strong>}
              {ingredient.item}
              {ingredient.note && <em> ({ingredient.note})</em>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Method</h2>
        <ol>
          {found.steps.map((step, i) => (
            <li key={i}>{step.text}</li>
          ))}
        </ol>
      </section>

      {/* Rendered and sanitised by the commerce service (`renderMarkdown`,
          escape-first); the storefront never renders Markdown itself. */}
      {found.html && (
        <section>
          <h2>Notes</h2>
          <div dangerouslySetInnerHTML={{ __html: found.html }} />
        </section>
      )}

      {products.length > 0 && (
        <section>
          <h2>Shop this recipe</h2>
          <div className="grid">
            {products.map((v) => (
              <ProductCard key={v.id} v={v} redirectTo={`/recipes/${found.slug}`} />
            ))}
          </div>
        </section>
      )}

      <p>
        <Link href="/recipes">All recipes</Link>
      </p>
    </article>
  );
}
