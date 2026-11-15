import { describe, it, expect } from 'vitest';
import { StatementsService } from './statements.service';
import { InMemoryInvoicesStore } from '../invoices/invoices.store';
import type { Invoice } from '../invoices/invoices.types';

const open: Invoice = {
  id: 'i1', number: 'INV-0001', orgId: 'org-1', issuedOn: '2025-11-01', dueOn: '2025-11-14',
  subtotalExVatCents: 100_000, vatCents: 15_000, totalIncVatCents: 115_000, status: 'open', lines: [],
};

describe('StatementsService', () => {
  it('builds a statement from the org invoices at a date', async () => {
    const svc = new StatementsService(new InMemoryInvoicesStore([open]));
    const statement = await svc.forOrg('org-1', '2025-11-28');
    expect(statement.balanceCents).toBe(115_000);
    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0].daysOverdue).toBe(14);
  });

  it('is empty for an org with no open invoices', async () => {
    const svc = new StatementsService(new InMemoryInvoicesStore([open]));
    expect((await svc.forOrg('org-2', '2025-11-28')).balanceCents).toBe(0);
  });
});
