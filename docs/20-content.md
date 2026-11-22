# Content: posts, recipes and buying guides

A food platform in KwaZulu-Natal competes on questions with purchase intent
behind them — "where to buy lamb in Durban", "how to cook goat curry", "is halaal
lamb available in Pietermaritzburg". Before this card there was no content
capability at all: no table, no route, no editor.

Content is also the substrate the assistant (T-074) retrieves from. Grounded only
in product rows it can answer "what is in the lamb box" and nothing else.

Code is `services/commerce/src/content`; the migration is `0023_content.sql`.

## One model, three kinds

`catalog.content` serves blog posts, recipes and buying guides (ADR 0013 §1)
because they share a shape and all link to products. `kind` separates them:

| kind | Use |
| --- | --- |
| `post` | News, farm notes, seasonal updates |
| `recipe` | How to cook something, with the products it needs |
| `guide` | Buying advice — "where to buy lamb in Durban" |

`catalog.content_products` links an item to the variants it is about, which is
what lets a buying guide put the right product in front of the reader.

## Markdown, rendered once

The body is Markdown, not HTML: diffable in review, writable by a non-technical
author, and safe once rendered by one tested pure function — the same pattern as
the notification templates.

### The safety property is structural

`renderMarkdown` **escapes the input first, then applies formatting**, and the
only tags in the output are ones the file writes itself. Raw HTML therefore
cannot survive:

```
<script>alert(1)</script>   →   <p>&lt;script&gt;alert(1)&lt;/script&gt;</p>
```

There is no third-party sanitiser to misconfigure and no allow-list to keep in
sync with a library upgrade. `javascript:` and `data:` links are dropped
entirely, because escaping the text does not help when the URL is an attribute
the browser acts on. Tests assert script tags, `<iframe>`, `<svg onload>`,
`<img onerror>`, quote-breakout in an `href`, and that the output contains no tag
outside the renderer's own set.

The subset is deliberate: headings, paragraphs, lists, emphasis, links, inline
and fenced code, blockquote, rules. It is not CommonMark. Content that needs more
than this is a signal to reconsider the body, not to add an HTML passthrough.

## The publish workflow

```
draft ──agent──▶ review ──person──▶ published
  └────────────person──────────────▶
```

An agent may move `draft → review`. **Only a person may publish** (ADR 0013 §1).

This is not bureaucracy. Publishing is the moment content becomes public
advertising under R146 of 2010, and an automated system must not be the thing
that makes that decision — a person's name is on it. The `actor` is stated in the
request rather than inferred, so an agent cannot silently become a person.

`archived` and `published` cannot be re-published. A published item is also not
patchable in place: editing what readers already linked to is what archiving and
re-publishing is for.

## Slugs

Deterministic from the title, so a retried request does not create a second row
under a different address, and collision-safe via `-2`, `-3`:

```
"Pietermaritzburg's best lamb"  →  pietermaritzburgs-best-lamb
"Braai & boerewors!"            →  braai-boerewors
"Café crème"                    →  cafe-creme
```

Apostrophes are dropped rather than turned into separators, accents are stripped,
and the slug is capped at 80 characters without ending on a separator. The
database's unique constraint is a backstop, not the mechanism.

A retitled draft gets a fresh slug; keeping the old one would leave the address
describing content it no longer is.

## SEO falls back rather than rendering empty tags

`seo_title` and `seo_description` fall back to `title` and `summary`. An empty
meta description is worse than a reused summary: the search engine invents its
own snippet and the page loses its one chance to say what it is about. A blank
explicit value is treated as absent.

## Row-level security

| Session | Sees |
| --- | --- |
| public | `published` only |
| staff | everything, including drafts |

The join table inherits its parent's visibility, so a draft's product links do not
leak. Verified against a `NOSUPERUSER` role: anonymous saw the published item and
its one link row; the draft and its link were invisible.

A draft's slug is a **404**, not a 403 — an unpublished address should not
confirm that it exists.

## Routes

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /commerce/content?kind=&taxonomy=&limit=&offset=` | public | published only, paginated |
| `GET /commerce/content/:slug` | public | one published item, rendered |
| `POST /commerce/content` | `content:write` | create a draft |
| `PATCH /commerce/content/:id` | `content:write` | edit a draft or an item under review |
| `POST /commerce/content/:id/publish` | `content:publish` | the workflow above |

`content:read`, `content:write` and `content:publish` were added to the RBAC
matrix and granted to `marketing`. `executive` and `chief_admin` pick up
`content:read` automatically through the `:read` suffix rule.

## Not in this card

No editor UI. This card is the model and the API; the storefront pages are T-072
and later. The store is in-memory behind the interface a SQL adapter implements,
as with the other commerce modules.
