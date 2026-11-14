import type { TemperatureClass } from '@ag/observability';

/** One row of `inventory.temperature_logs`. */
export interface TemperatureLog {
  id: string;
  subjectType: string;
  subjectId: string;
  celsius: number;
  at: string;
  source: string;
}

export interface TemperatureLogInput {
  subjectType: string;
  subjectId: string;
  celsius: number;
  at: string;
  source?: string;
}

/** Persistence boundary for `inventory.temperature_logs`. */
export interface TemperatureStore {
  list(filter?: { subjectType?: string; subjectId?: string }): Promise<TemperatureLog[]>;
  insertMany(logs: TemperatureLog[]): Promise<TemperatureLog[]>;
}

/** In-memory store used by tests and local runs until the SQL adapter is wired. */
export class InMemoryTemperatureStore implements TemperatureStore {
  private readonly rows: TemperatureLog[] = [];

  async list(filter: { subjectType?: string; subjectId?: string } = {}): Promise<TemperatureLog[]> {
    return this.rows
      .filter((r) => (filter.subjectType ? r.subjectType === filter.subjectType : true))
      .filter((r) => (filter.subjectId ? r.subjectId === filter.subjectId : true));
  }

  async insertMany(logs: TemperatureLog[]): Promise<TemperatureLog[]> {
    this.rows.push(...logs);
    return logs;
  }
}

/** How a subject's temperature class is resolved (its variant, via the batch). */
export interface SubjectClassSource {
  classOf(subjectType: string, subjectId: string): Promise<TemperatureClass>;
}
