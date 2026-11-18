# Access control
Least privilege, high access for leaders with safeguards, two-person approval on money and risk, full audit, MFA for all staff.

- **Chief administrator**: every permission. Destructive and financial actions are logged; break-glass use alerts the board.
- **Executive and management**: read everything, approve prices, credit, ads, refunds and payouts.
- **Developers**: non-production fully; production logs and metrics only. No standing access to personal data. Temporary elevation by approval, time limited and recorded (`identity.elevation_requests`).
- **DevOps and security**: infrastructure and secrets; production data is break-glass.
- **Partners, advertisers, customers, trade users**: see only their own organisation (row-level security).

Source of truth: `packages/rbac` (roles, permissions, matrix, two-person list). Every controller route must declare `@RequirePermissions(...)`. Admin navigation is generated from permissions. Two-person approval applies to: pricing publish, credit limits above the threshold, refunds above a limit, payouts, role changes, data exports, break-glass.

Technical: identity provider (Keycloak or Ory) with TOTP or passkeys, short sessions, IP allow-list for admin, row-level security, field-level encryption for personal data, append-only audit log, POPIA access logging (`audit.data_access_log`).

MFA enrolments are persisted in `identity.mfa_enrolments` (the SQL store is selected by `STORE_DRIVER=sql`), so a restart does not silently un-enrol staff. The TOTP secret is a credential and is stored encrypted at rest (field-level, as above): the service reads and writes it through `@ag/db`'s `FieldCipher` (AES-256-GCM, `v1:<iv>:<tag>:<ciphertext>`), keyed by `FIELD_ENCRYPTION_KEY`. Row-level security scopes a subject to their own row and lets staff read every row.
