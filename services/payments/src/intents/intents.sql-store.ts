import type { Db } from '@ag/db';
import { currentSession, toCents, toIso } from '@ag/db';
import { IntentStatus, PaymentIntent } from '../providers/payment-intent';
import { IntentStore } from './intents.store';

interface IntentRow {
  id: string;
  order_id: string | null;
  invoice_id: string | null;
  method: string;
  amount_inc_vat_cents: string | number;
  currency: string;
  provider: string | null;
  provider_ref: string | null;
  status: IntentStatus;
  idempotency_key: string;
  created_at: Date | string;
}

function toIntent(row: IntentRow): PaymentIntent {
  return {
    id: row.id,
    orderId: row.order_id ?? undefined,
    invoiceId: row.invoice_id ?? undefined,
    method: row.method as PaymentIntent['method'],
    amountIncVatCents: toCents(row.amount_inc_vat_cents),
    currency: 'ZAR',
    provider: row.provider ?? undefined,
    providerRef: row.provider_ref ?? undefined,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    createdAt: toIso(row.created_at),
  };
}

const COLUMNS =
  'id, order_id, invoice_id, method, amount_inc_vat_cents, currency, provider, provider_ref, status, idempotency_key, created_at';

/**
 * SQL adapter over `payments.intents`. The domain carries `provider`/`providerRef`
 * on the intent (the row also records the amount inc VAT, which is the column's
 * meaning); the columns come from migration 0008 plus the `provider_ref` added in
 * 0012.
 */
export class PgIntentStore implements IntentStore {
  constructor(private readonly db: Db) {}

  async getById(id: string): Promise<PaymentIntent | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<IntentRow>(`SELECT ${COLUMNS} FROM payments.intents WHERE id = $1`, [id]),
    );
    return rows[0] ? toIntent(rows[0]) : undefined;
  }

  async getByIdempotencyKey(key: string): Promise<PaymentIntent | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<IntentRow>(`SELECT ${COLUMNS} FROM payments.intents WHERE idempotency_key = $1`, [
        key,
      ]),
    );
    return rows[0] ? toIntent(rows[0]) : undefined;
  }

  async findByProviderRef(providerRef: string): Promise<PaymentIntent | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<IntentRow>(`SELECT ${COLUMNS} FROM payments.intents WHERE provider_ref = $1`, [
        providerRef,
      ]),
    );
    return rows[0] ? toIntent(rows[0]) : undefined;
  }

  async list(): Promise<PaymentIntent[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<IntentRow>(`SELECT ${COLUMNS} FROM payments.intents`),
    );
    return rows.map(toIntent);
  }

  async save(intent: PaymentIntent): Promise<PaymentIntent> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<IntentRow>(
        `INSERT INTO payments.intents
           (id, order_id, invoice_id, method, amount_inc_vat_cents, currency, provider, provider_ref, status, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           provider = EXCLUDED.provider,
           provider_ref = EXCLUDED.provider_ref,
           status = EXCLUDED.status
         RETURNING ${COLUMNS}`,
        [
          intent.id,
          intent.orderId ?? null,
          intent.invoiceId ?? null,
          intent.method,
          intent.amountIncVatCents,
          intent.currency,
          intent.provider ?? null,
          intent.providerRef ?? null,
          intent.status,
          intent.idempotencyKey,
          intent.createdAt,
        ],
      ),
    );
    return toIntent(rows[0]);
  }
}
