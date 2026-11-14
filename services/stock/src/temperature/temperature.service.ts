import { Inject, Injectable } from '@nestjs/common';
import {
  AlertRouter,
  temperatureAlert,
  temperatureIncidents,
  AlertSink,
  Alert,
  InMemoryAlertSink,
} from '@ag/observability';
import type { TemperatureClass } from '@ag/observability';
import {
  TemperatureLog,
  TemperatureLogInput,
  TemperatureStore,
  SubjectClassSource,
} from './temperature.types';

export const TEMPERATURE_STORE = Symbol('TEMPERATURE_STORE');
export const SUBJECT_CLASS_SOURCE = Symbol('SUBJECT_CLASS_SOURCE');
export const ALERT_SINK = Symbol('ALERT_SINK');

/**
 * Reads cold-chain readings, turns breaches into incidents (packages/observability)
 * and raises an alert through the router. This is the service behind the
 * "alert on temperature breach" acceptance for T-034.
 */
@Injectable()
export class TemperatureService {
  private readonly router: AlertRouter;

  constructor(
    @Inject(TEMPERATURE_STORE) private readonly store: TemperatureStore,
    @Inject(SUBJECT_CLASS_SOURCE) private readonly classes: SubjectClassSource,
    @Inject(ALERT_SINK) sink: AlertSink = new InMemoryAlertSink(),
  ) {
    this.router = new AlertRouter(sink);
  }

  /** All readings, newest first. */
  async list(filter: { subjectType?: string; subjectId?: string } = {}): Promise<TemperatureLog[]> {
    return (await this.store.list(filter)).sort((a, b) => b.at.localeCompare(a.at));
  }

  /**
   * Record readings, then evaluate them. Returns the incidents found and which
   * of them raised a new alert (a repeat of an open alert is suppressed).
   */
  async record(
    inputs: TemperatureLogInput[],
  ): Promise<{ incidents: number; alertsRaised: number }> {
    const logs: TemperatureLog[] = inputs.map((input, index) => ({
      id: `tlog_${input.subjectId}_${input.at}_${index}`,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      celsius: input.celsius,
      at: input.at,
      source: input.source ?? 'probe',
    }));
    await this.store.insertMany(logs);
    return this.evaluate(logs);
  }

  /** Re-evaluate everything already stored (used by the scheduled check). */
  async evaluateAll(): Promise<{ incidents: number; alertsRaised: number }> {
    return this.evaluate(await this.store.list());
  }

  private async evaluate(
    logs: TemperatureLog[],
  ): Promise<{ incidents: number; alertsRaised: number }> {
    const classCache = new Map<string, TemperatureClass>();
    for (const log of logs) {
      const key = `${log.subjectType}\u0000${log.subjectId}`;
      if (!classCache.has(key))
        classCache.set(key, await this.classes.classOf(log.subjectType, log.subjectId));
    }
    const classOf = (subjectType: string, subjectId: string): TemperatureClass =>
      classCache.get(`${subjectType}\u0000${subjectId}`) ?? 'chilled';

    const incidents = temperatureIncidents(logs, classOf);
    let alertsRaised = 0;
    for (const incident of incidents) {
      const alert: Alert = temperatureAlert(incident);
      if (await this.router.raise(alert)) alertsRaised += 1;
    }
    return { incidents: incidents.length, alertsRaised };
  }
}
