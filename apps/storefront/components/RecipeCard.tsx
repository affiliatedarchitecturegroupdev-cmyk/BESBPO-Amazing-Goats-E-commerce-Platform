import Link from 'next/link';
import type { RecipeSummary } from '@ag/api-client';

/**
 * A recipe card. The hero image is optional: a recipe published before its photo
 * is shot should still be readable, so the card degrades to text rather than
 * showing a broken image box.
 *
 * A plain `<img>` rather than `next/image`: recipe photos are editor-supplied
 * URLs from outside `public/`, and `next/image` needs the host configured at
 * build time. When images move into our own storage this becomes `next/image`.
 */
export function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  return (
    <article className="card recipe-card">
      <Link href={`/recipes/${recipe.slug}`}>
        {recipe.heroImageUrl ? (
          <img
            src={recipe.heroImageUrl}
            alt={recipe.title}
            width={480}
            height={320}
            loading="lazy"
          />
        ) : null}
        <h3>{recipe.title}</h3>
      </Link>
      {recipe.summary && <p className="p">{recipe.summary}</p>}
      <p>
        <small>
          {recipe.timeLabel} · Serves {recipe.servings}
        </small>
      </p>
    </article>
  );
}
