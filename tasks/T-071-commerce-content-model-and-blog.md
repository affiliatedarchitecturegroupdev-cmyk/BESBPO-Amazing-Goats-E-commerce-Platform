---
id: T-071
title: Commerce: content model and blog
phase: 6
agent: backend
gate: gate:db
files: ["services/commerce/src/**", "db/migrations/**", "packages/api-client/**"]
---
## Goal
A food platform in KwaZulu-Natal competes on questions with purchase intent behind
them: "where to buy lamb in Durban", "how to cook goat curry", "is halaal lamb
available in Pietermaritzburg". There is no content capability at all — no table, no
route, no editor.

Content is also the substrate the assistant (T-074) retrieves from. Grounded only in
product rows it can answer "what is in the lamb box" and nothing else.

One model serves blog posts, recipes and buying guides (ADR 0013 §1), because they
share a shape and all link to products.

## Acceptance
- [x] Migration adds `catalog.content` (`kind` in `post|recipe|guide`, `slug` unique, `title`, `summary`, `body_md`, `author_user_id`, `status` in `draft|review|published|archived`, `published_at`, `hero_image_url`, `seo_title`, `seo_description`, `taxonomy text[]`, timestamps)
- [x] Migration adds `catalog.content_products (content_id, variant_id)` linking a post to the products it is about
- [x] `GET /commerce/content?kind=&taxonomy=&status=published` — public list, published only, paginated
- [x] `GET /commerce/content/:slug` — one published item, or 404
- [x] `POST /commerce/content`, `PATCH /commerce/content/:id` — authoring, behind `content:write`
- [x] `POST /commerce/content/:id/publish` — behind `content:publish`; an agent may move `draft → review`, only a person moves `review → published` (ADR 0013 §1)
- [x] Markdown renders to HTML through one pure function, sanitised, tested against script injection and raw HTML
- [x] Slug generation is deterministic from the title and collision-safe
- [x] A published item's `seo_title` / `seo_description` fall back to `title` / `summary` rather than rendering empty tags
- [x] `content:write` and `content:publish` added to the permission list and to the `marketing` role in the RBAC matrix
- [x] Tests added and passing: publish workflow, published-only public reads, sanitisation, slug collisions, 404 for drafts

## Notes
Gate is `gate:db` (new migration) and touches RBAC.

Body is Markdown, not HTML: diffable, safe after sanitising, writable by a
non-technical author. Rendering happens once, in a tested pure function — the same
pattern as the notification templates.

Do not build an editor UI here. This card is the model and the API; the storefront
pages are T-072 and later.
