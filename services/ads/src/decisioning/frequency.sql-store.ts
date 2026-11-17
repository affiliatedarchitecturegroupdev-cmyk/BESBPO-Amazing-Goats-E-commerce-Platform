import type { Db } from '@ag/db';
import { currentSession } from '@ag/db';
import { FrequencyStore } from './frequency.store';

/**
 * SQL adapter over `ads.impressions` and `ads.clicks`. Frequency is counted per
 * user hash and creative, so a cap follows the person without storing who they
 * are (docs/06-ads.md: frequency caps, POPIA). The decisioning routes are
 * public, so these tables carry no row-level security — the counters hold no
 * personal data, only an opaque hash.
 */
export class PgFrequencyStore implements FrequencyStore {
  constructor(private readonly db: Db) {}

  async impressionsFor(userHash: string, creativeId: string): Promise<number> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM ads.impressions
          WHERE user_hash = $1 AND creative_id = $2`,
        [userHash, creativeId],
      ),
    );
    return Number(rows[0]?.count ?? 0);
  }

  async recordImpression(userHash: string, creativeId: string, slotCode: string): Promise<void> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(
        `INSERT INTO ads.impressions (creative_id, slot_code, user_hash) VALUES ($1, $2, $3)`,
        [creativeId, slotCode, userHash],
      ),
    );
  }

  async recordClick(userHash: string, creativeId: string): Promise<void> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(`INSERT INTO ads.clicks (creative_id, user_hash) VALUES ($1, $2)`, [
        creativeId,
        userHash,
      ]),
    );
  }
}
