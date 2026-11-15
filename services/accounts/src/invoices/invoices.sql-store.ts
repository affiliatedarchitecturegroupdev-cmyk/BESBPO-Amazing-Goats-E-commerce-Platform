import type { Db } from '@ag/db';
import { currentSession, toCents } from '@ag/db';
import { Invoice, InvoiceLine, InvoiceStatus } from './invoices.types';
import { InvoicesStore } from './invoices.store';

interface InvoiceRow {
  id: string;
  number: string;
  org_id: string;
  order_id: string | null;
  issued_on: string | Date;
  due_on: string | Date;
  subtotal_ex_vat_cents: string | number;
  vat_cents: string | number;
  total_inc_vat_cents: string | number;
  status: InvoiceStatus;
}

interface InvoiceLineRow {
  id: string;
  description: string;
  qty: string | number;
  unit_ex_vat_cents: string | number;
  total_ex_vat_cents: string | number;
}

/** A `date` column to a `YYYY-MM-DD` string; pg returns it as a Date at UTC midnight. */
function toDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

function toLine(row: InvoiceLineRow): InvoiceLine {
  return {
    id: row.id,
    description: row.description,
    qty: Number(row.qty),
    unitExVatCents: toCents(row.unit_ex_vat_cents),
    totalExVatCents: toCents(row.total_ex_vat_cents),
  };
}

function toInvoice(row: InvoiceRow, lines: InvoiceLine[]): Invoice {
  return {
    id: row.id,
    number: row.number,
    orgId: row.org_id,
    orderId: row.order_id ?? undefined,
    issuedOn: toDate(row.issued_on),
    dueOn: toDate(row.due_on),
    subtotalExVatCents: toCents(row.subtotal_ex_vat_cents),
    vatCents: toCents(row.vat_cents),
    totalIncVatCents: toCents(row.total_inc_vat_cents),
    status: row.status,
    lines,
  };
}

const COLUMNS =
  'id, number, org_id, order_id, issued_on, due_on, subtotal_ex_vat_cents, vat_cents, total_inc_vat_cents, status';

/** SQL adapter over `accounts.invoices` and `accounts.invoice_lines`; every query runs in an RLS session. */
export class PgInvoicesStore implements InvoicesStore {
  constructor(private readonly db: Db) {}

  private async linesFor(invoiceIds: string[]): Promise<Map<string, InvoiceLine[]>> {
    const byInvoice = new Map<string, InvoiceLine[]>();
    if (invoiceIds.length === 0) return byInvoice;
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<InvoiceLineRow & { invoice_id: string }>(
        `SELECT id, invoice_id, description, qty, unit_ex_vat_cents, total_ex_vat_cents
           FROM accounts.invoice_lines WHERE invoice_id = ANY($1) ORDER BY id`,
        [invoiceIds],
      ),
    );
    for (const row of rows) {
      const list = byInvoice.get(row.invoice_id) ?? [];
      list.push(toLine(row));
      byInvoice.set(row.invoice_id, list);
    }
    return byInvoice;
  }

  async all(): Promise<Invoice[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<InvoiceRow>(`SELECT ${COLUMNS} FROM accounts.invoices ORDER BY issued_on DESC`),
    );
    const lines = await this.linesFor(rows.map((r) => r.id));
    return rows.map((row) => toInvoice(row, lines.get(row.id) ?? []));
  }

  async get(id: string): Promise<Invoice | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<InvoiceRow>(`SELECT ${COLUMNS} FROM accounts.invoices WHERE id = $1`, [id]),
    );
    if (!rows[0]) return undefined;
    const lines = await this.linesFor([id]);
    return toInvoice(rows[0], lines.get(id) ?? []);
  }

  async insert(invoice: Invoice): Promise<Invoice> {
    await this.db.withSession(currentSession(), async (tx) => {
      await tx.query(
        `INSERT INTO accounts.invoices
           (id, number, org_id, order_id, issued_on, due_on, subtotal_ex_vat_cents, vat_cents, total_inc_vat_cents, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          invoice.id,
          invoice.number,
          invoice.orgId,
          invoice.orderId ?? null,
          invoice.issuedOn,
          invoice.dueOn,
          invoice.subtotalExVatCents,
          invoice.vatCents,
          invoice.totalIncVatCents,
          invoice.status,
        ],
      );
      await this.insertLines(tx, invoice.id, invoice.lines);
    });
    return invoice;
  }

  async replace(invoice: Invoice): Promise<Invoice> {
    await this.db.withSession(currentSession(), async (tx) => {
      const { rows } = await tx.query(
        `UPDATE accounts.invoices SET status = $2 WHERE id = $1 RETURNING id`,
        [invoice.id, invoice.status],
      );
      if (rows.length === 0) throw new Error(`invoice ${invoice.id} not found`);
      // Lines are immutable once issued; only the status changes after insert.
    });
    return invoice;
  }

  private async insertLines(tx: Db, invoiceId: string, lines: InvoiceLine[]): Promise<void> {
    for (const line of lines) {
      await tx.query(
        `INSERT INTO accounts.invoice_lines
           (id, invoice_id, description, qty, unit_ex_vat_cents, total_ex_vat_cents)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [line.id, invoiceId, line.description, line.qty, line.unitExVatCents, line.totalExVatCents],
      );
    }
  }
}
