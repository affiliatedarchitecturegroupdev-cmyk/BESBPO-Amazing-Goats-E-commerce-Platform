---
id: T-083
title: Storefront: show a signed-in trade buyer their own price, not public retail
phase: 5
agent: backend
gate: gate:rbac
files: ["services/gateway/src/bff/**", "apps/storefront/app/**", "apps/storefront/components/**", "packages/api-client/**"]
---
## Goal
A trade buyer who signs in and browses the shop sees `public` prices. T-082 made the
catalogue read anonymous and defaulted the price audience to `public`; the price-fill read
added for the product page and the merchandising tiles does the same. Nothing passes the
caller's trade audience through, because an anonymous shopper has none.

So a `trade_owner` with an agreed `trade_a` rate on a carcass is shown the retail price of
that carcass on the product page, and their cart — which prices at the trade audience —
charges them something else. Today that mismatch is invisible because the shop had no
prices at all; from the moment prices render, the shop can quote a trade buyer a figure it
will not charge them. That is worse than showing no price.

The audience machinery already exists end to end: `pricing.audiences` holds
`public | trader | trade_a | trade_b | bakery`, `resolvePrices()` resolves per audience,
and the bulk price route refuses a non-public audience to a caller without `pricing:read`.
What is missing is the storefront asking for the right audience when it has a session.

## Acceptance
- [ ] When the request carries a trade session, the BFF price-fill asks for that buyer's
      audience instead of `public`, and the storefront renders the resolved trade price
- [ ] The audience is derived from the caller's roles/account server-side, never from a
      query parameter the browser can set — a `?audience=trade_a` from a retail shopper
      must not select `trade_a`
- [ ] An anonymous visitor and a `customer_household` continue to get `public`, exactly as
      T-082 and T-083's predecessor left them
- [ ] If the caller's trade audience cannot be priced, the page does not fall back to the
      public price and charge a different one at checkout; it shows a "your price" state
- [ ] Warm-cache reads never cross callers: the price a trade buyer is quoted is never
      served to a different caller. `BffService.get` keys the cache on
      `${service}${path}|auth|anon`, so the audience *is* already part of the key (it
      travels in the query string) but the caller's identity is **not** — every
      authenticated caller shares one `auth` entry. Any pricing read that depends on who
      is asking must not use that shared key
- [ ] Tests added and passing: a trade session sees trade_a on the product page and tile,
      an anonymous caller sees public, a retail caller cannot force the audience by query
      string, and two audiences never share a cache entry

## Notes
Gate `gate:rbac` because this changes who may read what, and because the cache-key change
is the kind of thing that looks like a refactor and is actually an access-control boundary.

The BFF caches reads within a TTL under `${service}${path}|auth|anon`. The audience is
already carried in the path, so two audiences cannot collide — but the `auth` segmentation
is binary, so two *different* authenticated buyers share a cache entry. That is harmless
today because the only enriched read is the public price list, which is the same for
everyone; it stops being harmless the moment the price depends on the caller, which is
exactly what this card introduces. Decide the key shape (per audience, or no cache for
caller-dependent reads) before wiring the audience through, because getting it wrong
leaks one buyer's negotiated price to another and looks like a caching bug, not a
security one.

Related: T-009 (pricing), T-082 (anonymous catalogue read), and the price-fill work that
landed with it.
