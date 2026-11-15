import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InvoicesStore } from './invoices.store';
import { Invoice, InvoiceLine, InvoiceStatus } from './invoices.types';
import {
  InvoiceLineInput,
  invoiceTotals,
  lineTotalExVatCents,
  nextInvoiceNumber,
} from './invoice-totals.rules';

export const INVOICES_STORE = Symbol('INVOICES_STORE');

export interface CreateInvoiceInput {
  orgId: string;
  orderId?: string;
  issuedOn: string;
  dueOn: string;
  lines: InvoiceLineInput[];
}

/**
 * Invoices. The totals come from the pure `invoiceTotals` rule, so the invoice
 * and the storefront agree on VAT; the service only assigns identity and stores.
 */
@Injectable()
export class InvoicesService {
  constructor(@Inject(INVOICES_STORE) private readonly store: InvoicesStore) {}

  async list(): Promise<Invoice[]> {
    return (await this.store.all()).sort((a, b) => a.number.localeCompare(b.number));
  }

  async get(id: string): Promise<Invoice> {
    const invoice = await this.store.get(id);
    if (!invoice) throw new NotFoundException(`unknown invoice ${id}`);
    return invoice;
  }

  /** Issue an invoice: total the lines and assign the next sequential number. */
  async create(input: CreateInvoiceInput): Promise<Invoice> {
    const totals = invoiceTotals(input.lines);
    const lines: InvoiceLine[] = input.lines.map((line) => ({
      id: randomUUID(),
      description: line.description,
      qty: line.qty,
      unitExVatCents: line.unitExVatCents,
      totalExVatCents: lineTotalExVatCents(line),
    }));
    const sequence = (await this.store.all()).length + 1;
    return this.store.insert({
      id: randomUUID(),
      number: nextInvoiceNumber(sequence),
      orgId: input.orgId,
      orderId: input.orderId,
      issuedOn: input.issuedOn,
      dueOn: input.dueOn,
      ...totals,
      status: 'open',
      lines,
    });
  }

  /** Settle an invoice. Only an open invoice can be paid. */
  async markPaid(id: string): Promise<Invoice> {
    const invoice = await this.get(id);
    return this.store.replace({ ...invoice, status: 'paid' as InvoiceStatus });
  }
}
