import type { Db } from '@ag/db';
import { currentSession, toCents, toIso } from '@ag/db';
import { Chargeback, ChargebackStatus } from './chargebacks.types';
import { ChargebacksStore } from './chargebacks.store';

interface ChargebackRow {
  id: string;
  payment_id: string;
  payout_id: string;
  provider: string;
  amount_cents: string | number;
  reason: string | null;
  status: ChargebackStatus;
  received_at: Date | string;
}

function toChargeback(row: ChargebackRow): Chargeback {
  return {
    id: row.id,
    paymentId: row.payment_id,
    payoutId: row.payout_id,
    provider: row.provider,
    amountCents: toCents(row.amount_cents),
    reason: row.reason ?? '',
    status: row.status,
    receivedAt: toIso(row.received_at),
  };
}

const COLUMNS =
  'id, payment_id, payout_id, provider, amount_cents, reason, status, received_at';

/** SQL adapter over `payments.chargebacks`; every query runs in an RLS session. */
export class PgChargebacksStore implements ChargebacksStore {
  constructor(private readonly db: Db) {}

  async all(): Promise<Chargeback[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ChargebackRow>(`SELECT ${COLUMNS} FROM payments.chargebacks`),
    );
    return rows.map(toChargeback);
  }

  async get(id: string): Promise<Chargeback | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ChargebackRow>(`SELECT ${COLUMNS} FROM payments.chargebacks WHERE id = $1`, [id]),
    );
    return rows[0] ? toChargeback(rows[0]) : undefined;
  }

  async insert(chargeback: Chargeback): Promise<Chargeback> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ChargebackRow>(
        `INSERT INTO payments.chargebacks (id, payment_id, payout_id, provider, amount_cents, reason, status, received_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${COLUMNS}`,
        [
          chargeback.id,
          chargeback.paymentId,
          chargeback.payoutId,
          chargeback.provider,
          chargeback.amountCents,
          chargeback.reason,
          chargeback.status,
          chargeback.receivedAt,
        ],
      ),
    );
    return toChargeback(rows[0]);
  }

  async replace(chargeback: Chargeback): Promise<Chargeback> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ChargebackRow>(
        `UPDATE payments.chargebacks
            SET payment_id = $2, payout_id = $3, provider = $4, amount_cents = $5,
                reason = $6, status = $7, received_at = $8
          WHERE id = $1
          RETURNING ${COLUMNS}`,
        [
          chargeback.id,
          chargeback.paymentId,
          chargeback.payoutId,
          chargeback.provider,
          chargeback.amountCents,
          chargeback.reason,
          chargeback.status,
          chargeback.receivedAt,
        ],
      ),
    );
    if (!rows[0]) throw new Error(`chargeback ${chargeback.id} not found`);
    return toChargeback(rows[0]);
  }
}
