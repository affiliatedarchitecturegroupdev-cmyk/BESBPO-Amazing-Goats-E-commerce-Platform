import { Invoice } from './invoices.types';

/** Persistence boundary for invoices; the SQL adapter lands with the store swap. */
export interface InvoicesStore {
  all(): Promise<Invoice[]>;
  get(id: string): Promise<Invoice | undefined>;
  insert(invoice: Invoice): Promise<Invoice>;
  replace(invoice: Invoice): Promise<Invoice>;
}

/** In-memory store used by tests and local runs until the SQL adapter is wired. */
export class InMemoryInvoicesStore implements InvoicesStore {
  private readonly byId = new Map<string, Invoice>();

  constructor(seed: Invoice[] = []) {
    for (const invoice of seed) this.byId.set(invoice.id, invoice);
  }

  async all(): Promise<Invoice[]> {
    return [...this.byId.values()];
  }

  async get(id: string): Promise<Invoice | undefined> {
    return this.byId.get(id);
  }

  async insert(invoice: Invoice): Promise<Invoice> {
    this.byId.set(invoice.id, invoice);
    return invoice;
  }

  async replace(invoice: Invoice): Promise<Invoice> {
    this.byId.set(invoice.id, invoice);
    return invoice;
  }
}
