import type { Db } from '@ag/db';
import { currentSession, toIso } from '@ag/db';
import { TemperatureLog, TemperatureStore } from './temperature.types';

interface TemperatureRow {
  external_id: string;
  subject_type: string;
  subject_ref: string | null;
  celsius: string | number;
  at: Date | string;
  source: string;
}

const COLUMNS = 'external_id, subject_type, subject_ref, celsius, at, source';

function toLog(row: TemperatureRow): TemperatureLog {
  return {
    id: row.external_id,
    subjectType: row.subject_type,
    subjectId: row.subject_ref ?? '',
    celsius: Number(row.celsius),
    at: toIso(row.at),
    source: row.source,
  };
}

/**
 * SQL adapter over `inventory.temperature_logs`. The reading's id is the domain
 * id (`tlog_...`) in `external_id`; the subject is the domain id in
 * `subject_ref`, so the uuid column stays unused.
 */
export class PgTemperatureStore implements TemperatureStore {
  constructor(private readonly db: Db) {}

  async list(filter: { subjectType?: string; subjectId?: string } = {}): Promise<TemperatureLog[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filter.subjectType) {
      values.push(filter.subjectType);
      conditions.push(`subject_type = $${values.length}`);
    }
    if (filter.subjectId) {
      values.push(filter.subjectId);
      conditions.push(`subject_ref = $${values.length}`);
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<TemperatureRow>(`SELECT ${COLUMNS} FROM inventory.temperature_logs${where}`, values),
    );
    return rows.map(toLog);
  }

  async insertMany(logs: TemperatureLog[]): Promise<TemperatureLog[]> {
    const saved: TemperatureLog[] = [];
    for (const log of logs) {
      const { rows } = await this.db.withSession(currentSession(), (tx) =>
        tx.query<TemperatureRow>(
          `INSERT INTO inventory.temperature_logs
             (external_id, subject_type, subject_ref, celsius, at, source)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (external_id) DO UPDATE SET celsius = EXCLUDED.celsius
           RETURNING ${COLUMNS}`,
          [log.id, log.subjectType, log.subjectId, log.celsius, log.at, log.source],
        ),
      );
      if (rows[0]) saved.push(toLog(rows[0]));
    }
    return saved;
  }
}
