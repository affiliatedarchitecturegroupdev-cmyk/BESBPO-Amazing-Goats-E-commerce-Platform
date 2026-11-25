---
id: T-072
title: Storefront: recipes from content, replacing the /recipes stub
phase: 6
agent: frontend
gate: none
files: ["apps/storefront/**", "services/commerce/src/**"]
---
## Goal
`apps/storefront/app/recipes/page.tsx` is a stub that renders
`TODO(agent): build this screen from wireframe sf-recipes`. It is also in the sitemap
(`apps/storefront/lib/seo.ts`, `STATIC_ROUTES`) and in the PWA shell, so a public,
indexable route currently shows a placeholder.

Recipes are the highest-value content for a food platform: they answer "what do I do
with this", they carry `Recipe` structured data (the richest schema available to a
food site), and they are what the assistant needs to answer cooking questions.

## Acceptance
- [x] Migration adds `catalog.content_recipes (content_id, servings, prep_minutes, cook_minutes, ingredients jsonb, steps jsonb)`
- [x] `/recipes` lists published recipe content with hero image, title and cook time; no placeholder text remains
- [x] `/recipes/[slug]` renders one recipe: ingredients, numbered steps, servings and times, and the products it uses with add-to-cart
- [x] A recipe page links to the products it is about (`content_products`), so reading converts to buying
- [x] `pageMetadata` applied per recipe, with the recipe title and summary
- [x] `Recipe` JSON-LD emitted via T-073's `recipeJsonLd`, plus a `BreadcrumbList`; the generator is not duplicated
- [x] Empty state when no recipes are published: a real message, not a broken page
- [x] The stub `TODO(agent)` comment is removed
- [x] Tests added and passing: list, detail, missing slug 404, empty state

## Notes
Depends on T-071 for the content model. Keeps the storefront's existing read pattern
(server-side through `apps/storefront/lib/gateway.ts`), not a client-side fetch.

Ingredient quantities are free text in `jsonb`, because a recipe ingredient ("2 kg lamb
shoulder") is not a product quantity and forcing it into the catalogue model would be
wrong.

## Merge notes
T-055 (unmerged when this card was written) rewrote `/recipes` as a guest calculator and
cut guide, and created its own `lib/recipes.ts`. Both are kept:

- `lib/recipes.ts` stays T-055's calculator and cut guide (`estimateMeat`, `CUT_GUIDE`).
- This card's page-state rules moved to `lib/recipe-pages.ts`, so two unrelated modules
  no longer share a filename and neither loses its tests.
- `/recipes` renders the published recipe list **and** the calculator and cut guide; the
  calculator is the page's most-used tool and dropping it would have been a regression
  hidden inside a merge conflict.

`recipeProducts` now de-duplicates its variant ids: a recipe linked twice to one product
rendered the same card twice.
