import type { Db } from '@ag/db';
import { currentSession, toCents, toIso, toIsoOrUndefined } from '@ag/db';
import { Promotion, PromotionKind, PromotionStatus } from './promotions.types';
import { PromotionStore } from './promotions.store';

interface PromotionRow {
  external_id: string;
  code: string;
  name: string | null;
  kind: PromotionKind;
  value_cents: string | number | null;
  percent: string | number | null;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
  status: PromotionStatus;
  stackable: boolean;
  min_spend_cents: string | number | null;
  skus: string[] | null;
  max_uses_per_customer: number | null;
  approved_by: string | null;
}

function toPromotion(row: PromotionRow): Promotion {
  return {
    id: row.external_id,
    code: row.code,
    name: row.name ?? '',
    kind: row.kind,
    valueCents: row.value_cents == null ? undefined : toCents(row.value_cents),
    percent: row.percent == null ? undefined : Number(row.percent),
    startsAt: toIso(row.starts_at),
    endsAt: row.ends_at ? toIso(row.ends_at) : null,
    status: row.status,
    stackable: row.stackable,
    minSpendCents: row.min_spend_cents == null ? undefined : toCents(row.min_spend_cents),
    skus: row.skus ?? undefined,
    maxUsesPerCustomer: row.max_uses_per_customer ?? undefined,
    approvedBy: row.approved_by ?? undefined,
  };
}

const COLUMNS =
  'external_id, code, name, kind, value_cents, percent, starts_at, ends_at, status, stackable, min_spend_cents, skus, max_uses_per_customer, approved_by';

/**
 * SQL adapter over `sales.promotions`. The domain id is the string `external_id`.
 * A draft promotion is not public, so the RLS policy on the table hides drafts
 * from a non-staff session; the store does not add a filter of its own.
 */
export class PgPromotionStore implements PromotionStore {
  constructor(private readonly db: Db) {}

  async all(): Promise<Promotion[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<PromotionRow>(`SELECT ${COLUMNS} FROM sales.promotions ORDER BY code`),
    );
    return rows.map(toPromotion);
  }

  async get(id: string): Promise<Promotion | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<PromotionRow>(`SELECT ${COLUMNS} FROM sales.promotions WHERE external_id = $1`, [id]),
    );
    return rows[0] ? toPromotion(rows[0]) : undefined;
  }

  async insert(promotion: Promotion): Promise<Promotion> {
    return this.write(promotion);
  }

  async replace(promotion: Promotion): Promise<Promotion> {
    return this.write(promotion);
  }

  private async write(promotion: Promotion): Promise<Promotion> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(
        `INSERT INTO sales.promotions
           (external_id, code, name, kind, value_cents, percent, starts_at, ends_at, status,
            stackable, min_spend_cents, skus, max_uses_per_customer, approved_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (external_id) DO UPDATE SET
           code = EXCLUDED.code, name = EXCLUDED.name, kind = EXCLUDED.kind,
           value_cents = EXCLUDED.value_cents, percent = EXCLUDED.percent,
           starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, status = EXCLUDED.status,
           stackable = EXCLUDED.stackable, min_spend_cents = EXCLUDED.min_spend_cents,
           skus = EXCLUDED.skus, max_uses_per_customer = EXCLUDED.max_uses_per_customer,
           approved_by = EXCLUDED.approved_by`,
        [
          promotion.id,
          promotion.code,
          promotion.name,
          promotion.kind,
          promotion.valueCents ?? null,
          promotion.percent ?? null,
          promotion.startsAt,
          promotion.endsAt,
          promotion.status,
          promotion.stackable,
          promotion.minSpendCents ?? null,
          promotion.skus ?? null,
          promotion.maxUsesPerCustomer ?? null,
          promotion.approvedBy ?? null,
        ],
      ),
    );
    return promotion;
  }
}
