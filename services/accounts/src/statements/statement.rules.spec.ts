import { describe, it, expect } from 'vitest';
import { buildStatement } from './statement.rules';
import type { Invoice } from '../invoices/invoices.types';

function invoice(over: Partial<Invoice>): Invoice {
  return {
    id: 'i1', number: 'INV-0001', orgId: 'org-1', issuedOn: '2025-11-01', dueOn: '2025-11-14',
    subtotalExVatCents: 100_000, vatCents: 15_000, totalIncVatCents: 115_000, status: 'open', lines: [], ...over,
  };
}

describe('buildStatement', () => {
  it('includes only open invoices for the org and totals the balance', () => {
    const statement = buildStatement('org-1', [
      invoice({ id: 'a', number: 'INV-0001', dueOn: '2025-11-14', totalIncVatCents: 115_000 }),
      invoice({ id: 'b', number: 'INV-0002', dueOn: '2025-11-07', totalIncVatCents: 50_000, status: 'paid' }),
      invoice({ id: 'c', number: 'INV-0003', orgId: 'org-2', totalIncVatCents: 999_999 }),
    ], '2025-11-28');

    expect(statement.lines.map((l) => l.number)).toEqual(['INV-0001']);
    expect(statement.balanceCents).toBe(115_000);
  });

  it('ages a line into the right bucket', () => {
    const statement = buildStatement('org-1', [
      invoice({ id: 'a', number: 'INV-0001', dueOn: '2025-10-01', totalIncVatCents: 10_000 }),
    ], '2025-11-28');
    expect(statement.lines[0].daysOverdue).toBe(58);
    expect(statement.lines[0].bucket).toBe('31-60');
    expect(statement.byBucket['31-60']).toBe(10_000);
    expect(statement.byBucket.current).toBe(0);
  });
});
