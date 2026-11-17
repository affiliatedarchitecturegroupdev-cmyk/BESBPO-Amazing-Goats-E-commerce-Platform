import type { Db } from '@ag/db';
import { currentSession, toIso } from '@ag/db';
import { ClickRow, ImpressionRow } from './reporting.rules';
import { ReportingStore } from './reporting.store';

interface ImpressionDbRow {
  creative_id: string;
  slot_code: string;
  at: Date | string;
}

interface ClickDbRow {
  creative_id: string;
  at: Date | string;
}

/**
 * SQL adapter over `ads.impressions` and `ads.clicks`. The rows carry no
 * personal data — a creative and a slot, never a visitor — so the rollup stays
 * the same pure function. `ads.impressions` is partitioned by `at`, so the read
 * is a plain scan across partitions.
 */
export class PgReportingStore implements ReportingStore {
  constructor(private readonly db: Db) {}

  async impressions(): Promise<ImpressionRow[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ImpressionDbRow>(`SELECT creative_id, slot_code, at FROM ads.impressions`),
    );
    return rows.map((row) => ({
      creativeId: row.creative_id,
      slotCode: row.slot_code,
      at: toIso(row.at),
    }));
  }

  async clicks(): Promise<ClickRow[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ClickDbRow>(`SELECT creative_id, at FROM ads.clicks`),
    );
    return rows.map((row) => ({ creativeId: row.creative_id, at: toIso(row.at) }));
  }
}
