# Observability in one shared package, alerts to one webhook
Status: accepted

Log redaction, the health-report shape, the alert router and the cold-chain
temperature rules live in `packages/observability` as pure functions with their
own specs, and every service and app depends on the package. Logs are one JSON
line to stdout, redacted at any depth, because Northflank and Koyeb collect them
and POPIA applies once a line leaves the platform.

Platform alerts (Northflank, Koyeb) and application alerts (cold-chain breach in
the stock service) post to a single webhook, so an operator watches one channel.
Deduplication lives in the application (`AlertRouter`) rather than the receiver,
so a sustained breach pages once and only a severity change re-fires. The
alternative — a per-service logging library and a separate alerting tool — was
rejected: it duplicates the redaction rule that has to be right in one place.
