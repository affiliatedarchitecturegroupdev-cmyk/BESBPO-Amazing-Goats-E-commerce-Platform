import type { Db } from '@ag/db';
import { currentSession } from '@ag/db';
import { Batch, BatchStatus } from './batches.types';
import { BatchStore } from './batches.store';

interface BatchRow {
  external_id: string;
  batch_code: string;
  sku: string;
  pack: string | null;
  source_org_ref: string | null;
  processor_org_ref: string | null;
  slaughtered_on: Date | string | null;
  packed_on: Date | string | null;
  use_by: Date | string | null;
  gross_weight_g: string | number | null;
  grade: string | null;
  halaal_certified: boolean;
  temperature_status: string;
  status: BatchStatus;
}

/** A `date` column to `YYYY-MM-DD`. */
function toDate(value: Date | string | null): string | undefined {
  if (value === null) return undefined;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function toBatch(row: BatchRow): Batch {
  const source = toDate(row.slaughtered_on);
  return {
    id: row.external_id,
    batchCode: row.batch_code,
    sku: row.sku,
    pack: row.pack ?? '',
    ...(row.source_org_ref ? { sourceOrgId: row.source_org_ref } : {}),
    ...(row.processor_org_ref ? { processorOrgId: row.processor_org_ref } : {}),
    ...(source ? { slaughteredOn: source } : {}),
    ...(toDate(row.packed_on) ? { packedOn: toDate(row.packed_on)! } : {}),
    ...(toDate(row.use_by) ? { useBy: toDate(row.use_by)! } : {}),
    ...(row.gross_weight_g !== null ? { grossWeightG: Number(row.gross_weight_g) } : {}),
    ...(row.grade ? { grade: row.grade } : {}),
    halaalCertified: row.halaal_certified,
    temperatureStatus: row.temperature_status,
    status: row.status,
  };
}

const COLUMNS = `b.external_id, b.batch_code, v.sku, b.pack,
  so.external_id AS source_org_ref, po.external_id AS processor_org_ref,
  b.slaughtered_on, b.packed_on, b.use_by, b.gross_weight_g, b.grade,
  b.halaal_certified, b.temperature_status, b.status`;

const FROM = `inventory.batches b
  JOIN catalog.variants v ON v.id = b.variant_id
  LEFT JOIN identity.orgs so ON so.id = b.source_org_id
  LEFT JOIN identity.orgs po ON po.id = b.processor_org_id`;

/**
 * SQL adapter over `inventory.batches`. The domain carries a SKU (not the
 * variant uuid) and organisation domain ids, so the row is joined to
 * `catalog.variants` and `identity.orgs`; `external_id` holds the domain batch id.
 */
export class PgBatchStore implements BatchStore {
  constructor(private readonly db: Db) {}

  async list(): Promise<Batch[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<BatchRow>(`SELECT ${COLUMNS} FROM ${FROM} ORDER BY b.batch_code`),
    );
    return rows.map(toBatch);
  }

  async get(id: string): Promise<Batch | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<BatchRow>(`SELECT ${COLUMNS} FROM ${FROM} WHERE b.external_id = $1`, [id]),
    );
    return rows[0] ? toBatch(rows[0]) : undefined;
  }

  async insertMany(batches: Batch[]): Promise<Batch[]> {
    const saved: Batch[] = [];
    for (const batch of batches) {
      const { rows } = await this.db.withSession(currentSession(), (tx) =>
        tx.query<BatchRow>(
          `WITH upserted AS (
             INSERT INTO inventory.batches
               (external_id, batch_code, variant_id, pack, source_org_id, processor_org_id,
                slaughtered_on, packed_on, use_by, gross_weight_g, grade, halaal_certified,
                temperature_status, status)
             SELECT $1, $2, v.id, $4, so.id, po.id, $7, $8, $9, $10, $11, $12, $13, $14
               FROM catalog.variants v
               LEFT JOIN identity.orgs so ON so.external_id = $5
               LEFT JOIN identity.orgs po ON po.external_id = $6
              WHERE v.sku = $3
             ON CONFLICT (external_id) DO UPDATE SET status = EXCLUDED.status
             RETURNING *
           )
           SELECT ${COLUMNS} FROM upserted b
             JOIN catalog.variants v ON v.id = b.variant_id
             LEFT JOIN identity.orgs so ON so.id = b.source_org_id
             LEFT JOIN identity.orgs po ON po.id = b.processor_org_id`,
          [
            batch.id,
            batch.batchCode,
            batch.sku,
            batch.pack,
            batch.sourceOrgId ?? null,
            batch.processorOrgId ?? null,
            batch.slaughteredOn ?? null,
            batch.packedOn ?? null,
            batch.useBy ?? null,
            batch.grossWeightG ?? null,
            batch.grade ?? null,
            batch.halaalCertified,
            batch.temperatureStatus,
            batch.status,
          ],
        ),
      );
      if (rows[0]) saved.push(toBatch(rows[0]));
    }
    return saved;
  }

  async setStatus(id: string, status: BatchStatus): Promise<void> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(`UPDATE inventory.batches SET status = $2 WHERE external_id = $1`, [id, status]),
    );
  }
}
