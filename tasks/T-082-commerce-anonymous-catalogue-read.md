---
id: T-082
title: Commerce: anonymous catalogue read behind an active-only RLS session
phase: 5
agent: backend
gate: gate:rbac
files: ["db/migrations/**", "db/tests/**", "services/commerce/src/catalog/**", "services/commerce/src/pricing/**", "packages/api-client/**", "packages/rbac/**"]
---
## Goal
A shopper cannot browse the shop without an account. Every catalogue read is behind
`@RequirePermissions('catalog:read')`, and `catalog:read` is held only by staff roles
(`ops_manager`, `sales`, `procurement`, `quality`, `marketing`, `developer`). A
`customer_household` holds only `customer:own`. `PermissionsGuard` answers `401` with no
session and `403` without the permission, so an anonymous visitor to `/shop/lamb` sees
"Please sign in to see this."

That is the wrong shape for a consumer shop. A grocery storefront is browsed before it is
joined; requiring an account to see a price is the single largest drop-off in the funnel
and it makes the storefront untestable end to end without a seeded staff user.

The fix is not to hand `catalog:read` to an anonymous caller. The catalogue tables carry
`product_compliance` (packer, pack station, label text) and `price_lists` carries five
audiences (`public`, `trader`, `trade_a`, `trade_b`, `bakery`). A blanket grant would put
trade pricing and compliance records one guessed query string away.

Instead the read is scoped in the database: an anonymous session sees only active rows,
by row-level security, and only the `public` price list. The domain already has the rule —
`catalog.merch_sections` uses exactly this policy shape (`staff = 'on' OR (active AND
window)`) and `catalog.content` uses `status = 'published' OR staff = 'on'`. This card
extends that established pattern to the product catalogue rather than inventing a new one.

## Acceptance
- [x] `catalog.products`, `catalog.variants` and `catalog.price_lists` get
      `ENABLE ROW LEVEL SECURITY` and a `SELECT` policy of the form
      `staff = 'on' OR active`, following `merch_sections_select` and
      `content_public_read`; writes stay staff-only
- [x] `catalog.price_list_items` inherits its list's visibility through a subquery
      policy, so a `trader` price cannot be read by an anonymous caller who guesses a
      list id — the `content_products` pattern
- [x] A price read is restricted to the `public` audience unless the caller holds
      `pricing:read`; `?audience=trader` from an anonymous caller is refused, not
      silently downgraded, so the refusal is observable and testable
- [x] `GET /commerce/catalog`, `GET /commerce/catalog/search` and
      `GET /commerce/catalog/:sku` are reachable without a session and return active
      rows only; an inactive product and an inactive variant are both absent
- [x] The session is explicit: an unauthenticated catalogue request runs under a named
      anonymous context (`runWithSession({ staff: false })`), not by accident of the
      middleware default, so the intent is readable in the code
- [x] A draft (`active = false`) product, an expired price list and a `trader` price are
      each proven invisible to an anonymous caller in `db/tests/rls.sql`
- [x] The same three reads still work for a signed-in customer and for staff, and staff
      still see inactive rows
- [x] Tests added and passing: the storefront home, category and product pages render a
      price for a visitor with no `ag_token` cookie

## Notes
Gate `gate:rbac` because this changes who may read what. It must be approved before the
migration is applied, and the policies are the part a reviewer should read first.

Two things this card deliberately does not do:

1. **It does not expose `product_compliance`.** Allergen and nutrition data is T-076's
   card and carries its own legal gate. Enabling RLS on `catalog.products` does not widen
   `product_compliance`, which has no policy today and so stays staff-only once the
   application role is used.
2. **It does not fix the storefront's missing price.** The catalogue row carries no
   price; `priceCents` is optional and the product page renders `R ---` today because
   `pricing:read` is required for every price read. The `public`-audience price read in
   this card is what lets the page show a real price, but wiring that into
   `loadCatalogue` is follow-on work in the same change only if it stays small —
   otherwise it is its own card and this one lands the read path.

The `db/README.md` warning applies: the application must connect as a `NOSUPERUSER
NOBYPASSRLS` role that is not the table owner, or every policy here is silently inert.
`db/tests/rls.sql` proves that trap for the existing tables and must be extended for the
three new ones.
