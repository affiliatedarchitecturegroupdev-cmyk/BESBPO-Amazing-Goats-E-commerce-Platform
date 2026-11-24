---
id: T-075
title: Storefront: social share, follow links and Open Graph completion
phase: 6
agent: frontend
gate: none
files: ["apps/storefront/**"]
---
## Goal
Social integration hides three unrelated things under one heading, and they are not
equally valuable (docs/17-growth-and-experience.md §7):

- **Share and follow** — cheap, real value.
- **Social proof feed** — needs tokens and caching; X/Instagram APIs are restrictive.
- **Publish** — gated, because it messages the public.

This card does the first. The other two are deliberately not here.

## Acceptance
- [x] Share targets (WhatsApp, Facebook, X, email) on product and recipe pages, with the canonical URL and title
      (`lib/share.ts`, `components/ShareLinks.tsx`; email replaces copy-link, which needs JavaScript)
- [x] Social follow links in the site footer (`apps/storefront/components/SiteFooter.tsx`), driven by configuration rather than hard-coded, so a missing handle renders nothing rather than a dead link
      (`lib/social-links.ts`, `NEXT_PUBLIC_SOCIAL_*`)
- [x] Open Graph completion: `og:image` on product and recipe pages using the product or hero image, with a sensible fallback to the existing `opengraph-image`
      (`pageMetadata({ imageUrl })` + `absoluteImage`; products have no image field yet, so they use the fallback)
- [x] WhatsApp sharing is first-class, not an afterthought — it is the dominant sharing channel for South African grocery retail
- [x] Share buttons work without JavaScript where practical (plain links), so they do not cost a hydration boundary
- [x] Tests added and passing: share URL construction, footer renders no dead links when unconfigured
      (`lib/share.spec.ts` 9, `lib/social-links.spec.ts` 8, `lib/seo.spec.ts` +6); storefront 238 passed, monorepo 2021

## Notes
No gate. Deliberately excludes the social feed and social publishing; both need their
own decision and the publish path is `gate:outbound`.

Do not add third-party tracking pixels here. Analytics is its own card and must be
privacy-reviewed under POPIA first.
