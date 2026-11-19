import type { Db } from '@ag/db';
import { currentSession, toIsoOrUndefined } from '@ag/db';
import { ProofOfDelivery } from './proof-of-delivery.types';
import { ProofOfDeliveryStore } from './proof-of-delivery.store';

interface ProofRow {
  stop_ref: string;
  signature_url: string | null;
  photo_urls: string[] | null;
  temperature_c: string | number | null;
  temperature_excursion: boolean;
  captured_at: Date | string | null;
  recipient_name: string | null;
}

const COLUMNS =
  'stop_ref, signature_url, photo_urls, temperature_c, temperature_excursion, captured_at, recipient_name';

/** `numeric` comes back as a string from `node-pg`, so the reading is coerced. */
function toNumber(value: string | number | null): number | undefined {
  if (value === null) return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toProof(row: ProofRow): ProofOfDelivery {
  const temperatureC = toNumber(row.temperature_c);
  const photoRef = row.photo_urls?.[0];
  return {
    stopId: row.stop_ref,
    ...(row.signature_url ? { signature: row.signature_url } : {}),
    ...(photoRef ? { photoRef } : {}),
    ...(temperatureC !== undefined ? { temperatureC } : {}),
    ...(temperatureC !== undefined ? { temperatureExcursion: row.temperature_excursion } : {}),
    capturedAt: toIsoOrUndefined(row.captured_at) ?? '',
    ...(row.recipient_name ? { recipientName: row.recipient_name } : {}),
  };
}

/**
 * SQL adapter over `logistics.proof_of_delivery`, keyed by the stop's domain id
 * (`stop_ref`). The signature is kept in `signature_url` as the typed name or
 * data URL the app captured, and the photo reference in `photo_urls`, which is
 * already a text array.
 */
export class PgProofOfDeliveryStore implements ProofOfDeliveryStore {
  constructor(private readonly db: Db) {}

  async list(): Promise<ProofOfDelivery[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ProofRow>(
        `SELECT ${COLUMNS} FROM logistics.proof_of_delivery
          WHERE stop_ref IS NOT NULL ORDER BY captured_at DESC`,
      ),
    );
    return rows.map(toProof);
  }

  async get(stopId: string): Promise<ProofOfDelivery | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ProofRow>(
        `SELECT ${COLUMNS} FROM logistics.proof_of_delivery WHERE stop_ref = $1`,
        [stopId],
      ),
    );
    return rows[0] ? toProof(rows[0]) : undefined;
  }

  /**
   * Insert the proof unless the stop already has one. `ON CONFLICT DO NOTHING`
   * plus a follow-up read keeps the first capture, so a replayed sync returns
   * the original record rather than overwriting the evidence.
   */
  async save(proof: ProofOfDelivery): Promise<ProofOfDelivery> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ProofRow>(
        `INSERT INTO logistics.proof_of_delivery
           (stop_ref, signature_url, photo_urls, temperature_c, temperature_excursion,
            captured_at, recipient_name)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()), $7)
         ON CONFLICT (stop_ref) DO NOTHING
         RETURNING ${COLUMNS}`,
        [
          proof.stopId,
          proof.signature ?? null,
          proof.photoRef ? [proof.photoRef] : null,
          proof.temperatureC ?? null,
          proof.temperatureExcursion ?? false,
          proof.capturedAt ?? null,
          proof.recipientName ?? null,
        ],
      ),
    );
    if (rows[0]) return toProof(rows[0]);
    const existing = await this.get(proof.stopId);
    return existing ?? proof;
  }
}
