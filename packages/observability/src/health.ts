/**
 * Health contract (task T-034). Every service exposes the same shape so the
 * Northflank and Koyeb probes, and the uptime check, read one format. A service
 * reports `degraded` when a dependency it needs is not ready, which keeps a
 * half-started instance out of the load balancer.
 */

export type HealthStatus = 'ok' | 'degraded';

export interface DependencyHealth {
  name: string;
  ok: boolean;
  /** Why the dependency is not ready; omitted when ok. */
  detail?: string;
}

export interface HealthReport {
  status: HealthStatus;
  service: string;
  version?: string;
  checkedAt: string;
  dependencies: DependencyHealth[];
}

export interface HealthInput {
  service: string;
  version?: string;
  checkedAt?: Date;
  dependencies?: DependencyHealth[];
}

/**
 * Build the health report. The service is `ok` only when every dependency is
 * ok; one failed dependency makes the whole service `degraded` so the probe
 * fails and the instance is taken out of rotation.
 */
export function healthReport(input: HealthInput): HealthReport {
  const dependencies = input.dependencies ?? [];
  const report: HealthReport = {
    status: dependencies.every((d) => d.ok) ? 'ok' : 'degraded',
    service: input.service,
    checkedAt: (input.checkedAt ?? new Date()).toISOString(),
    dependencies,
  };
  if (input.version) report.version = input.version;
  return report;
}

/** HTTP status for a report: 200 when ok, 503 when degraded. */
export function healthHttpStatus(report: HealthReport): number {
  return report.status === 'ok' ? 200 : 503;
}
