import type { Db } from '@ag/db';
import { currentSession, toCents } from '@ag/db';
import { Refund, RefundStatus } from './refunds.types';
import { RefundsStore } from './refunds.store';

interface RefundRow {
  id: string;
  payment_id: string;
  amount_cents: string | number;
  reason: string | null;
  requested_by: string;
  approved_by: string | null;
  status: RefundStatus;
}

function toRefund(row: RefundRow): Refund {
  return {
    id: row.id,
    paymentId: row.payment_id,
    amountCents: toCents(row.amount_cents),
    reason: row.reason ?? '',
    requestedBy: row.requested_by,
    approvedBy: row.approved_by ?? undefined,
    status: row.status,
  };
}

const COLUMNS = 'id, payment_id, amount_cents, reason, requested_by, approved_by, status';

/** SQL adapter over `payments.refunds`; every query runs in an RLS session. */
export class PgRefundsStore implements RefundsStore {
  constructor(private readonly db: Db) {}

  async all(): Promise<Refund[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<RefundRow>(`SELECT ${COLUMNS} FROM payments.refunds`),
    );
    return rows.map(toRefund);
  }

  async get(id: string): Promise<Refund | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<RefundRow>(`SELECT ${COLUMNS} FROM payments.refunds WHERE id = $1`, [id]),
    );
    return rows[0] ? toRefund(rows[0]) : undefined;
  }

  async insert(refund: Refund): Promise<Refund> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<RefundRow>(
        `INSERT INTO payments.refunds (id, payment_id, amount_cents, reason, requested_by, approved_by, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${COLUMNS}`,
        [
          refund.id,
          refund.paymentId,
          refund.amountCents,
          refund.reason,
          refund.requestedBy,
          refund.approvedBy ?? null,
          refund.status,
        ],
      ),
    );
    return toRefund(rows[0]);
  }

  async replace(refund: Refund): Promise<Refund> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<RefundRow>(
        `UPDATE payments.refunds
            SET payment_id = $2, amount_cents = $3, reason = $4, requested_by = $5,
                approved_by = $6, status = $7
          WHERE id = $1
          RETURNING ${COLUMNS}`,
        [
          refund.id,
          refund.paymentId,
          refund.amountCents,
          refund.reason,
          refund.requestedBy,
          refund.approvedBy ?? null,
          refund.status,
        ],
      ),
    );
    if (!rows[0]) throw new Error(`refund ${refund.id} not found`);
    return toRefund(rows[0]);
  }
}

