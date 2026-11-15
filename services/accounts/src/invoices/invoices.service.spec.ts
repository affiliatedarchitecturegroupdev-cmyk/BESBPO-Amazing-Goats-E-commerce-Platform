import { describe, it, expect } from 'vitest';
import { InvoicesService } from './invoices.service';
import { InMemoryInvoicesStore } from './invoices.store';

const input = {
  orgId: 'org-1', issuedOn: '2025-11-01', dueOn: '2025-11-14',
  lines: [{ description: 'Lamb carcass', qty: 2, unitExVatCents: 90_000 }],
};

describe('InvoicesService', () => {
  it('issues an invoice with VAT and a sequential number', async () => {
    const svc = new InvoicesService(new InMemoryInvoicesStore());
    const invoice = await svc.create(input);
    expect(invoice.number).toBe('INV-0001');
    expect(invoice.subtotalExVatCents).toBe(180_000);
    expect(invoice.vatCents).toBe(27_000);
    expect(invoice.totalIncVatCents).toBe(207_000);
    expect(invoice.status).toBe('open');
    expect(invoice.lines).toHaveLength(1);
  });

  it('increments the number for the next invoice', async () => {
    const svc = new InvoicesService(new InMemoryInvoicesStore());
    await svc.create(input);
    expect((await svc.create(input)).number).toBe('INV-0002');
  });

  it('settles an invoice', async () => {
    const svc = new InvoicesService(new InMemoryInvoicesStore());
    const invoice = await svc.create(input);
    expect((await svc.markPaid(invoice.id)).status).toBe('paid');
  });

  it('reports an unknown invoice rather than inventing one', async () => {
    await expect(new InvoicesService(new InMemoryInvoicesStore()).get('nope')).rejects.toThrow(/unknown invoice/);
  });
});
