/**
 * Invoice totals. The VAT rate is the South African standard rate; the same 15%
 * as the storefront and pricing (T-009). Kept here as a named constant so the
 * invoice total and the storefront total cannot drift apart silently.
 */
export const STANDARD_VAT_RATE_PERCENT = 15;

/** Raised when an invoice cannot be totalled (bad quantity or unit price). */
export class InvoiceRuleError extends Error {}

export interface InvoiceLineInput {
  description: string;
  qty: number;
  unitExVatCents: number;
}

export interface InvoiceTotals {
  subtotalExVatCents: number;
  vatCents: number;
  totalIncVatCents: number;
}

/** Round half-up to whole cents, so a line total and the VAT are always exact. */
function roundCents(value: number): number {
  return Math.round(value + Number.EPSILON);
}

/**
 * Total an invoice from its lines: sum each line excluding VAT (quantity times
 * unit price, rounded to whole cents), add VAT on the subtotal, and return the
 * three money fields the schema stores. Quantity may be fractional (kg, litres),
 * so a line is rounded before it is summed.
 */
export function invoiceTotals(
  lines: readonly InvoiceLineInput[],
  ratePercent: number = STANDARD_VAT_RATE_PERCENT,
): InvoiceTotals {
  if (lines.length === 0) throw new InvoiceRuleError('an invoice needs at least one line');
  let subtotalExVatCents = 0;
  for (const line of lines) {
    if (!Number.isFinite(line.qty) || line.qty <= 0) {
      throw new InvoiceRuleError(`line "${line.description}" needs a positive quantity`);
    }
    if (!Number.isInteger(line.unitExVatCents) || line.unitExVatCents < 0) {
      throw new InvoiceRuleError(`line "${line.description}" needs a whole-cent unit price`);
    }
    subtotalExVatCents += roundCents(line.qty * line.unitExVatCents);
  }
  const vatCents = roundCents((subtotalExVatCents * ratePercent) / 100);
  return { subtotalExVatCents, vatCents, totalIncVatCents: subtotalExVatCents + vatCents };
}

/** The per-line excluding-VAT total the schema stores on `accounts.invoice_lines`. */
export function lineTotalExVatCents(line: InvoiceLineInput): number {
  return roundCents(line.qty * line.unitExVatCents);
}

/** A sequential invoice number, zero padded to four digits, as the wireframe shows (INV-0412). */
export function nextInvoiceNumber(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence <= 0) {
    throw new InvoiceRuleError('an invoice sequence must be a positive integer');
  }
  return `INV-${String(sequence).padStart(4, '0')}`;
}
