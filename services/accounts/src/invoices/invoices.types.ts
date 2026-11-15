export type InvoiceStatus = 'open' | 'paid' | 'void';

export interface InvoiceLine {
  id: string;
  description: string;
  qty: number;
  unitExVatCents: number;
  totalExVatCents: number;
}

export interface Invoice {
  id: string;
  number: string;
  orgId: string;
  orderId?: string;
  issuedOn: string;
  dueOn: string;
  subtotalExVatCents: number;
  vatCents: number;
  totalIncVatCents: number;
  status: InvoiceStatus;
  lines: InvoiceLine[];
}
