---
id: T-058
title: Identity and gateway: sign-in front door (OIDC and session)
phase: 5
agent: backend
gate: none
files: ["services/identity/src/auth/**", "services/gateway/src/auth/**", "packages/api-client/**"]
---

**Status: done.** Sign-in front door in the gateway: OIDC authorisation code
+ PKCE, JWKS id-token verification, httpOnly session and refresh cookies, and
the staff IP allow-list shared with the admin portal via `@ag/rbac`.

## Goal
There is no front door. `GET /gateway/auth/me` and `/session` only describe an
already-authenticated caller, and no endpoint anywhere issues a session. Every
authenticated journey (account, trade portal, admin, driver, advertiser,
partner) has no way in.

Add the sign-in flow the architecture already names: an identity provider
(Keycloak or Ory) with TOTP or passkeys, short sessions, and an IP allow-list
for admin (`docs/02-access-control.md`).

## Acceptance
- [x] `GET /gateway/auth/login` redirects to the IdP with an OIDC authorisation-code + PKCE request and a signed `state`
- [x] `GET /gateway/auth/callback` exchanges the code, verifies the id token against the IdP JWKS, upserts the local user, sets the httpOnly session cookie and redirects to the return path
- [x] `POST /gateway/auth/logout` clears the session; `POST /gateway/auth/refresh` renews a short session without re-prompting
- [x] `GET /gateway/auth/me` and `/session` still resolve the caller, now from a real session
- [x] The staff IP allow-list is enforced on admin routes (config-driven, per `docs/02-access-control.md`)
- [x] `packages/api-client` gains `loginUrl(returnTo)`, `logout()` and `session()` reads
- [x] Tests added and passing

## Notes
Gate is `gate:rbac`. The guard already resolves the caller through
`userFromRequest` (`@ag/nest-auth`), so this issues the token that guard
consumes. Reuse the MFA verify in `services/identity/src/mfa` for the
second factor. Keep the token server-side only (`docs/01-architecture.md`).
There is no `middleware.ts` in any app yet; the app-side redirect belongs with
T-059.
