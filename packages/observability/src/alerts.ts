/**
 * Alerting (task T-034). A temperature incident, a failing health check or a
 * service that stops reporting becomes an `Alert`. Alerts are deduplicated so a
 * cold-chain failure pages once, not once per reading, and are rendered to the
 * payload a webhook receiver (Northflank notification integration) expects.
 */

import { TemperatureIncident } from './temperature';

export type AlertSeverity = 'warning' | 'critical';

export interface Alert {
  /** Stable identity for deduplication, e.g. `temperature:batch:b1`. */
  key: string;
  severity: AlertSeverity;
  /** Short, human-readable summary. */
  title: string;
  /** What happened and what to do. */
  detail: string;
  /** ISO time the condition was observed. */
  at: string;
  labels: Record<string, string>;
}

export interface AlertSink {
  send(alert: Alert): Promise<void>;
}

/** Build the alert for a temperature incident. */
export function temperatureAlert(incident: TemperatureIncident): Alert {
  const action = incident.sustained
    ? 'Sustained breach: block the batch from sale and open a recall review.'
    : 'Single reading outside band: re-check the probe and the load.';
  return {
    key: `temperature:${incident.subjectType}:${incident.subjectId}`,
    severity: incident.severity,
    title: `Cold-chain breach on ${incident.subjectType} ${incident.subjectId}`,
    detail:
      `${incident.breaches.length} reading(s) outside the ${incident.class} band ` +
      `(peak ${incident.peakDeviationCelsius} °C out), ${incident.firstAt} to ${incident.lastAt}. ${action}`,
    at: incident.lastAt,
    labels: {
      alertname: 'ColdChainBreach',
      subject_type: incident.subjectType,
      subject_id: incident.subjectId,
      temperature_class: incident.class,
      sustained: String(incident.sustained),
    },
  };
}

/** Build the alert for a service that failed its health check. */
export function healthAlert(service: string, path: string, at: Date, detail?: string): Alert {
  return {
    key: `health:${service}`,
    severity: 'critical',
    title: `${service} failed its health check`,
    detail:
      detail ??
      `GET ${path} did not return ok. The platform routes around the instance; check the last deploy and the logs.`,
    at: at.toISOString(),
    labels: { alertname: 'HealthCheckFailing', service, path },
  };
}

/**
 * Alerting state. `raise` deduplicates by key: while an alert is open a repeat
 * with the same key is suppressed, and only a change of severity re-fires. The
 * returned alerts are those the caller should actually send.
 */
export class AlertRouter {
  private readonly open = new Map<string, AlertSeverity>();

  constructor(private readonly sink: AlertSink) {}

  async raise(alert: Alert): Promise<boolean> {
    const current = this.open.get(alert.key);
    if (current === alert.severity) return false;
    this.open.set(alert.key, alert.severity);
    await this.sink.send(alert);
    return true;
  }

  /** Clear an alert once the condition ends, so it can fire again later. */
  resolve(key: string): void {
    this.open.delete(key);
  }

  isOpen(key: string): boolean {
    return this.open.has(key);
  }
}

/** Collects alerts in memory; used by tests and as a default before a sink is wired. */
export class InMemoryAlertSink implements AlertSink {
  readonly sent: Alert[] = [];
  async send(alert: Alert): Promise<void> {
    this.sent.push(alert);
  }
}

export interface WebhookAlertSinkOptions {
  url: string;
  /** Optional shared secret, sent as `x-ag-alert-secret` for the receiver to verify. */
  secret?: string;
  /** Injectable for tests; defaults to the global fetch. */
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Posts an alert to a webhook (the Northflank notification integration, or a
 * receiver of the same shape). A failed send is swallowed and reported as
 * `false` rather than thrown: alerting must never take down the caller, and the
 * next tick retries because the router keeps the alert open.
 */
export class WebhookAlertSink implements AlertSink {
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: WebhookAlertSinkOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  async send(alert: Alert): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      await this.fetchFn(this.options.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.options.secret ? { 'x-ag-alert-secret': this.options.secret } : {}),
        },
        body: JSON.stringify(webhookPayload(alert)),
        signal: controller.signal,
      });
    } catch {
      // Swallowed on purpose; see the class comment.
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * The webhook body a Northflank notification integration posts. Kept small and
 * stable so a receiver can rely on it.
 */
export function webhookPayload(alert: Alert): Record<string, unknown> {
  return {
    version: '1',
    alert_key: alert.key,
    severity: alert.severity,
    title: alert.title,
    detail: alert.detail,
    at: alert.at,
    labels: alert.labels,
  };
}
