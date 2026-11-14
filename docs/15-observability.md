# Observability, logging and alerts

Implemented in `packages/observability` (pure functions, tested) and wired into
the services. Task T-034.

## Logging

`createLogger` writes one JSON line per call to stdout, which Northflank and
Koyeb collect without a sidecar. Every field is passed through `redact`, which
replaces the value of any key that looks like a credential or personal data with
`[redacted]`, at any depth. The rule is a pure function so it is tested directly;
it exists because logs leave the platform (log drains, support exports) and POPIA
forbids standing access to personal data (docs/07-compliance.md).

Sensitive keys include passwords, tokens, authorisation headers, cookies, API
keys, card numbers, CVV, and the personal identifiers email, phone, ID number
and passport. An `Error` is reduced to its message so a stack trace never
reaches a log line.

## Health checks

Every deployable serves `GET /health` and returns the shared `HealthReport`
shape: `{ status, service, checkedAt, dependencies }`. `status` is `ok` only when
every dependency is `ok`, otherwise `degraded`; the HTTP status is 200 or 503.
Nest services return the report from a controller; the Next.js apps return it
from `app/health/route.ts`. `infra/deploy.spec.mjs` fails the build if any
Northflank service points its probe at anything other than `/health`, or if the
matching route file is missing.

## Alerts

Two sources feed one webhook:

- Platform events: a Northflank notification integration (`RAW_WEBHOOK`) watches
  deployment status, build failure, job-run failure and addon-backup failure.
  Koyeb watches health-check failure and instance crash. See
  `infra/observability/notification-integration.json`.
- Application events: the stock service evaluates `inventory.temperature_logs`
  and posts a cold-chain breach to the same webhook.

`AlertRouter` deduplicates by key: while an alert is open, a repeat at the same
severity is suppressed, and only a change of severity re-fires. `resolve` clears
an alert once the condition ends. `WebhookAlertSink` posts the alert; a failed
send is swallowed so alerting never takes down the caller, and the next tick
retries because the router keeps the alert open.

## Cold chain

Chilled stock is held at 0 to 4 °C and frozen at -18 °C or colder
(docs/04-cutoff-engine.md). `evaluateReading` flags any reading outside the band;
`temperatureIncidents` groups breaches per subject and marks an incident
`sustained` when two or more breaches fall inside a 60 minute window. A sustained
breach is critical and tells the operator to block the batch from sale and open a
recall review; a single spike is a warning to re-check the probe.

The stock service records readings, raises alerts on the incident, and a periodic
scheduler (`TEMPERATURE_TICK_MS`, default 15 minutes) re-checks what is stored so
a breach that arrives without a write is still caught.

## Configuration

| Variable | Purpose |
|---|---|
| `ALERT_WEBHOOK_URL` | Where the application posts alerts. Set from the Northflank secret group. |
| `ALERT_WEBHOOK_SECRET` | Optional shared secret, sent as `x-ag-alert-secret`. |
| `LOG_DRAIN_URL`, `LOG_DRAIN_SECRET` | Northflank log drain target. |
| `TEMPERATURE_TICK_MS` | Cold-chain re-check interval, milliseconds. |

All four credential values are template arguments in `infra/northflank/project.json`
and are never committed with a value.
