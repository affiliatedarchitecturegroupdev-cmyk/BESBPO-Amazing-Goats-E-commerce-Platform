import type { Db } from '@ag/db';
import { currentSession } from '@ag/db';
import { ComplianceStore } from './compliance.service';
import { LabelCompliance } from './label';

interface ComplianceRow {
  sku: string;
  rule_set: string;
  class_or_grade: string | null;
  packer_name: string | null;
  pack_station_no: string | null;
  label_text: string | null;
  certificate_expiry: Date | string | null;
}

function toCompliance(row: ComplianceRow): LabelCompliance & { variantSku: string } {
  return {
    variantSku: row.sku,
    ruleSet: row.rule_set,
    classOrGrade: row.class_or_grade,
    packerName: row.packer_name,
    packStationNo: row.pack_station_no,
    labelText: row.label_text,
    certificateExpiry: row.certificate_expiry
      ? (row.certificate_expiry instanceof Date
          ? row.certificate_expiry.toISOString()
          : String(row.certificate_expiry)
        ).slice(0, 10)
      : null,
  };
}

const SELECT_COMPLIANCE = `
  SELECT v.sku, c.rule_set, c.class_or_grade, c.packer_name, c.pack_station_no, c.label_text, c.certificate_expiry
    FROM catalog.product_compliance c
    JOIN catalog.variants v ON v.id = c.variant_id`;

/**
 * SQL adapter over `catalog.product_compliance`, keyed by the variant's SKU (the
 * domain key); the table's `variant_id` is the internal uuid.
 */
export class PgComplianceStore implements ComplianceStore {
  constructor(private readonly db: Db) {}

  async all(): Promise<LabelCompliance[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ComplianceRow>(`${SELECT_COMPLIANCE} ORDER BY v.sku`),
    );
    return rows.map(toCompliance);
  }

  async get(sku: string): Promise<(LabelCompliance & { variantSku: string }) | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ComplianceRow>(`${SELECT_COMPLIANCE} WHERE v.sku = $1`, [sku]),
    );
    return rows[0] ? toCompliance(rows[0]) : undefined;
  }

  async upsert(record: LabelCompliance & { variantSku: string }): Promise<LabelCompliance> {
    await this.db.withSession(currentSession(), async (tx) => {
      const variant = await tx.query<{ id: string }>(
        `SELECT id FROM catalog.variants WHERE sku = $1`,
        [record.variantSku],
      );
      if (!variant.rows[0]) throw new Error(`unknown sku ${record.variantSku}`);
      await tx.query(
        `INSERT INTO catalog.product_compliance
           (variant_id, rule_set, class_or_grade, packer_name, pack_station_no, label_text, certificate_expiry)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (variant_id) DO UPDATE SET
           rule_set = EXCLUDED.rule_set, class_or_grade = EXCLUDED.class_or_grade,
           packer_name = EXCLUDED.packer_name, pack_station_no = EXCLUDED.pack_station_no,
           label_text = EXCLUDED.label_text, certificate_expiry = EXCLUDED.certificate_expiry`,
        [
          variant.rows[0].id,
          record.ruleSet,
          record.classOrGrade ?? null,
          record.packerName ?? null,
          record.packStationNo ?? null,
          record.labelText ?? null,
          record.certificateExpiry ?? null,
        ],
      );
    });
    return record;
  }
}
