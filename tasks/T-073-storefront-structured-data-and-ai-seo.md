---
id: T-073
title: Storefront: structured data and AI-era SEO
phase: 6
agent: frontend
gate: none
files: ["apps/storefront/**"]
---
## Goal
T-064 did the mechanical SEO: sitemap, robots, per-page metadata, Open Graph, PWA
manifest. What is missing is what search engines and answer engines actually extract.
There is no `application/ld+json` anywhere in the storefront, so a product page is
plain text to a crawler: no price, no availability, no rating, no recipe.

"AI-led SEO" is not a separate system. It is content that answers a question, marked up
so a machine can extract the answer, plus clean HTML and an `llms.txt` so an assistant
can cite it.

## Acceptance
- [x] `apps/storefront/lib/jsonld.ts` — pure generators, each taking the object the page already renders: `productJsonLd`, `offerJsonLd`, `recipeJsonLd`, `breadcrumbJsonLd`, `organizationJsonLd`, `faqJsonLd`, `articleJsonLd`
- [x] `Product` + `Offer` on `/product/[slug]`: `sku`, `priceCurrency: ZAR`, `availability`, and `priceSpecification` stating that prices exclude VAT (the platform's rule, `docs/13-pricing.md`)
- [x] `AggregateRating` emitted **only** for variants that have published reviews, from the T-070 aggregate — never for ratings not shown on the page
- [ ] `Recipe` on `/recipes/[slug]` (T-072), `Article` on blog posts (T-071) — **generators built and tested, wiring deferred**: both pages are absent from `main` (T-072 is unmerged; no blog route exists)
- [x] `BreadcrumbList` on category and product pages (recipe and post pages do not exist yet: T-072 is unmerged, there is no blog route)
- [x] `Organization` sitewide with the KZN delivery area and contact
- [ ] `FAQPage` on the FAQ page from T-077 — **generator built and tested, wiring deferred**: `/faq` is T-077's
- [x] `app/llms.txt/route.ts` — a plain-text summary of the site for AI crawlers: what the business is, key pages, product categories
- [x] A test asserts the JSON-LD price equals the price the page displays, for the same variant; drifted structured data is worse than none and earns a manual action
- [x] A test asserts no `AggregateRating` is emitted for a variant with zero published reviews
- [x] Rendered JSON-LD is valid JSON with no unescaped `<` or `</script>` injection

## Notes
No gate, but this card is where a wrong price becomes a search-engine penalty, so the
equality test is not optional.

`AggregateRating` deliberately waits for T-070. Marking up ratings that are not on the
page is a spam signal.

Keep generators pure and colocated with `lib/seo.ts` so the sitemap, the metadata and
the markup all derive from the same catalogue objects.
