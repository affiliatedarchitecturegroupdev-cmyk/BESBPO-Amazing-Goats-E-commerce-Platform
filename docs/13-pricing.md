# Pricing
Implemented in `services/commerce/src/pricing` (tested). Prices are integer cents in ZAR, stored excluding VAT; VAT is added at display and invoice time.

## Price lists
A price list is a set of per-SKU prices for one audience, valid for a time window.

| Audience | Who it serves |
|---|---|
| `public` | the open storefront |
| `trader` | registered traders |
| `trade_a`, `trade_b` | trade account tiers |
| `bakery` | bakeries (early route slots, standing orders) |

Lifecycle: `draft` → `pending_approval` → `published`; a published list that is replaced becomes `superseded`. Only one list per audience is live at a time: publishing a newer list supersedes the previous one.

A list is **live** when it is published and `now` falls inside `[validFrom, validTo)`. The window is half-open, so a list stops being live at the instant it expires and two lists never overlap on the boundary. When several lists for an audience are live (for example a correction published the same day), the one with the latest `validFrom` wins.

## Two-person approval
Publishing a price change is a four-eyes action (see `docs/02-access-control.md`, ADR 0005). The publisher must hold `pricing:approve` **and** be a different person from the requester: `publish` throws if `approvedBy === requestedBy`. `pricing:approve` is in the RBAC `TWO_PERSON` list (`packages/rbac`), and a test asserts the two stay aligned.

## VAT
Standard rate 15%. `addVat`/`removeVat` take an optional rate, so zero-rated goods (many basic foodstuffs) price at 0%. `vatBreakdown` returns `{ exVatCents, vatCents, incVatCents }` where the parts always add up, rounding half-up to whole cents.

## Resolution
`resolvePrice(lists, audience, sku, at)` returns the live list's price for a SKU with its VAT breakdown, or `null` when the audience has no live list or the list does not carry the SKU. `null` is deliberate: the caller falls back (for example to the public list) rather than the platform guessing a price. `resolvePrices` reads the list once, so every price in a batch comes from the same list version.

## Not yet wired
The store is in-memory (`InMemoryPricingStore`); the SQL adapter for `catalog.price_lists` and `catalog.price_list_items` lands with the store swap. Orders still carry `unitPriceExVatCents` on the cart line; wiring checkout to `resolvePrices` is a follow-up.
