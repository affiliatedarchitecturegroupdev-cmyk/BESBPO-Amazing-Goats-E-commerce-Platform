import type { Db } from '@ag/db';
import { currentSession, toCents } from '@ag/db';
import { Settlement, SettlementLine } from './reconciliation.types';
import { ReconciliationStore } from './reconciliation.store';

interface SettlementRow {
  id: string;
  provider: string;
  period_start: Date | string;
  period_end: Date | string;
  gross_cents: string | number | null;
  fees_cents: string | number | null;
  net_cents: string | number | null;
  bank_ref: string | null;
  matched: boolean;
}

interface LineRow {
  settlement_id: string;
  payment_id: string;
  amount_cents: string | number | null;
}

/** A `date` column to a `YYYY-MM-DD` string, without a timezone shift. */
function toDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function toSettlement(row: SettlementRow): Settlement {
  return {
    id: row.id,
    provider: row.provider,
    periodStart: toDate(row.period_start),
    periodEnd: toDate(row.period_end),
    grossCents: toCents(row.gross_cents ?? 0),
    feesCents: toCents(row.fees_cents ?? 0),
    netCents: toCents(row.net_cents ?? 0),
    bankRef: row.bank_ref ?? '',
    matched: row.matched,
  };
}

function toLine(row: LineRow): SettlementLine {
  return {
    settlementId: row.settlement_id,
    paymentId: row.payment_id,
    amountCents: toCents(row.amount_cents ?? 0),
  };
}

/**
 * SQL adapter over `payments.settlements` and `payments.settlement_lines`.
 * `knownPaymentIds` reads `payments.payments`, which a settlement line may point
 * at; a line that names a payment outside that set is what reconciliation
 * reports as `unknown_payment`.
 */
export class PgReconciliationStore implements ReconciliationStore {
  constructor(private readonly db: Db) {}

  async settlements(): Promise<Settlement[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<SettlementRow>(
        `SELECT id, provider, period_start, period_end, gross_cents, fees_cents, net_cents, bank_ref, matched
           FROM payments.settlements`,
      ),
    );
    return rows.map(toSettlement);
  }

  async lines(): Promise<SettlementLine[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<LineRow>(
        `SELECT settlement_id, payment_id, amount_cents FROM payments.settlement_lines`,
      ),
    );
    return rows.map(toLine);
  }

  async knownPaymentIds(): Promise<ReadonlySet<string>> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<{ id: string }>(`SELECT id FROM payments.payments`),
    );
    return new Set(rows.map((row) => row.id));
  }

  async markMatched(settlementId: string, matched: boolean): Promise<void> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(`UPDATE payments.settlements SET matched = $2 WHERE id = $1`, [
        settlementId,
        matched,
      ]),
    );
  }
}
