---
id: T-064
title: Apps: error, not-found and loading screens; SEO and PWA basics
phase: 5
agent: frontend
gate: none
files: ["apps/storefront/**", "apps/trade-portal/**", "apps/admin/**", "apps/advertiser-portal/**", "apps/partner-portal/**", "apps/driver-pwa/**"]
---
## Goal
No app has an `error.tsx`, `not-found.tsx`, `loading.tsx` or `global-error.tsx`,
so an unhandled error or a bad URL shows the raw Next.js default. The storefront
has no `sitemap.ts`, `robots.ts` or favicon, so search engines and link previews
have nothing to work with.

## Acceptance
- [ ] `not-found.tsx` and `error.tsx` in every app, styled with the brand and offering a route back
- [ ] `loading.tsx` for the storefront's dynamic routes (catalogue, product, search, checkout)
- [ ] A `global-error.tsx` in the storefront that still renders the shell
- [ ] `sitemap.ts` and `robots.ts` in the storefront, listing the public routes
- [ ] Favicon, `icon` and an `opengraph-image` for the storefront, plus `manifest.json` and an installable PWA shell for the storefront (the driver PWA already ships one)
- [ ] Per-page `metadata` on the storefront's public routes
- [ ] Tests added and passing

## Notes
Small, self-contained and unblocks trust and SEO. The `app/health/route.ts`
convention already exists, so the file layout is known. Keep the storefront's
error copy in plain language and free of personal data.
