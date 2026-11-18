---
id: T-059
title: Apps: sign-in screens, session guard and role-aware navigation
phase: 5
agent: frontend
gate: none
files: ["apps/storefront/**", "apps/trade-portal/**", "apps/admin/**", "apps/advertiser-portal/**", "apps/partner-portal/**", "apps/driver-pwa/**"]
---
## Goal
Even with the sign-in endpoints (T-058) no app has a way to reach them. There is
no `login` page, no `register` page and no `middleware.ts` in any of the six
apps. Build the human front door and the guard that protects each app's private
routes.

## Acceptance
- [ ] A sign-in screen in every app that calls `GET /gateway/auth/login` with a `returnTo` and returns to it after the callback
- [ ] A `middleware.ts` per app redirects an unauthenticated request to the sign-in screen, and a signed-in caller with the wrong role to a "no access" screen
- [ ] The storefront sign-in carries the "trade customer" entry and links to `/trade` for businesses
- [ ] The header shows the signed-in identity and a sign-out action; admin navigation is generated from the caller's permissions (`packages/rbac`), as `docs/02-access-control.md` requires
- [ ] An MFA step appears when the IdP asks for a second factor
- [ ] Tests added and passing

## Notes
Depends on T-058 for the endpoints. Keep the token in the httpOnly cookie the
gateway sets; never read it in client code. The storefront's `/trade` screen
(T-056) links here. Reuse the pattern in `apps/driver-pwa/lib/gateway.ts`, which
already forwards the cookie server-side.
