import type { Db } from '@ag/db';
import { currentSession, toCents, toIsoOrUndefined } from '@ag/db';
import { Payout, PayoutStatus } from './payouts.types';
import { PayoutsStore } from './payouts.store';

interface PayoutRow {
  id: string;
  payee_org_id: string;
  amount_cents: string | number;
  requested_by: string;
  approved_by: string | null;
  provider: string | null;
  status: PayoutStatus;
  paid_at: Date | string | null;
}

function toPayout(row: PayoutRow): Payout {
  return {
    id: row.id,
    payeeOrgId: row.payee_org_id,
    amountCents: toCents(row.amount_cents),
    requestedBy: row.requested_by,
    approvedBy: row.approved_by ?? undefined,
    provider: row.provider ?? undefined,
    status: row.status,
    paidAt: toIsoOrUndefined(row.paid_at),
  };
}

const COLUMNS =
  'id, payee_org_id, amount_cents, requested_by, approved_by, provider, status, paid_at';

/** SQL adapter over `payments.payouts`; every query runs in an RLS session. */
export class PgPayoutsStore implements PayoutsStore {
  constructor(private readonly db: Db) {}

  async all(): Promise<Payout[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<PayoutRow>(`SELECT ${COLUMNS} FROM payments.payouts`),
    );
    return rows.map(toPayout);
  }

  async get(id: string): Promise<Payout | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<PayoutRow>(`SELECT ${COLUMNS} FROM payments.payouts WHERE id = $1`, [id]),
    );
    return rows[0] ? toPayout(rows[0]) : undefined;
  }

  async insert(payout: Payout): Promise<Payout> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<PayoutRow>(
        `INSERT INTO payments.payouts (id, payee_org_id, amount_cents, requested_by, approved_by, provider, status, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${COLUMNS}`,
        [
          payout.id,
          payout.payeeOrgId,
          payout.amountCents,
          payout.requestedBy,
          payout.approvedBy ?? null,
          payout.provider ?? null,
          payout.status,
          payout.paidAt ?? null,
        ],
      ),
    );
    return toPayout(rows[0]);
  }

  async replace(payout: Payout): Promise<Payout> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<PayoutRow>(
        `UPDATE payments.payouts
            SET payee_org_id = $2, amount_cents = $3, requested_by = $4, approved_by = $5,
                provider = $6, status = $7, paid_at = $8
          WHERE id = $1
          RETURNING ${COLUMNS}`,
        [
          payout.id,
          payout.payeeOrgId,
          payout.amountCents,
          payout.requestedBy,
          payout.approvedBy ?? null,
          payout.provider ?? null,
          payout.status,
          payout.paidAt ?? null,
        ],
      ),
    );
    if (!rows[0]) throw new Error(`payout ${payout.id} not found`);
    return toPayout(rows[0]);
  }
}
