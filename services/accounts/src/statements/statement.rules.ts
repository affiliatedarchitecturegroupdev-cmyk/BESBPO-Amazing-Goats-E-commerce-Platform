import type { Invoice } from '../invoices/invoices.types';
import { AgeingBucket, ageingBucket, daysPastDue } from '../collections/dunning.rules';

export interface StatementLine {
  invoiceId: string;
  number: string;
  dueOn: string;
  totalIncVatCents: number;
  daysOverdue: number;
  bucket: AgeingBucket;
}

export interface Statement {
  orgId: string;
  asOf: string;
  balanceCents: number;
  lines: StatementLine[];
  byBucket: Record<AgeingBucket, number>;
}

const EMPTY_BUCKETS: Record<AgeingBucket, number> = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };

/**
 * Build a trade customer's statement from their open invoices at `asOf`: one line
 * per open invoice, ageing into buckets, and the total balance. Paid invoices are
 * excluded, so the balance is what is still owed.
 */
export function buildStatement(orgId: string, invoices: readonly Invoice[], asOf: string): Statement {
  const lines: StatementLine[] = invoices
    .filter((invoice) => invoice.orgId === orgId && invoice.status === 'open')
    .map((invoice) => {
      const overdue = daysPastDue(invoice.dueOn, asOf);
      return {
        invoiceId: invoice.id,
        number: invoice.number,
        dueOn: invoice.dueOn,
        totalIncVatCents: invoice.totalIncVatCents,
        daysOverdue: overdue,
        bucket: ageingBucket(overdue),
      };
    })
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));

  const byBucket = { ...EMPTY_BUCKETS };
  let balanceCents = 0;
  for (const line of lines) {
    byBucket[line.bucket] += line.totalIncVatCents;
    balanceCents += line.totalIncVatCents;
  }
  return { orgId, asOf, balanceCents, lines, byBucket };
}
