import { describe, it, expect } from 'vitest';
import {
  InvoiceRuleError,
  STANDARD_VAT_RATE_PERCENT,
  invoiceTotals,
  lineTotalExVatCents,
  nextInvoiceNumber,
} from './invoice-totals.rules';

describe('invoice totals', () => {
  it('uses the standard South African VAT rate', () => {
    expect(STANDARD_VAT_RATE_PERCENT).toBe(15);
  });

  it('sums lines, adds VAT on the subtotal and returns the inclusive total', () => {
    const totals = invoiceTotals([
      { description: 'Lamb carcass', qty: 2, unitExVatCents: 90_000 },
      { description: 'Egg trays', qty: 20, unitExVatCents: 2_000 },
    ]);
    expect(totals.subtotalExVatCents).toBe(220_000);
    expect(totals.vatCents).toBe(33_000);
    expect(totals.totalIncVatCents).toBe(253_000);
  });

  it('rounds a fractional quantity line to whole cents before summing', () => {
    // 1.5 kg at R30.33/kg = R45.495 -> R45.50
    expect(lineTotalExVatCents({ description: 'Chicken', qty: 1.5, unitExVatCents: 3_033 })).toBe(4_550);
  });

  it('rejects an invoice with no lines', () => {
    expect(() => invoiceTotals([])).toThrow(InvoiceRuleError);
  });

  it('rejects a non-positive quantity and a fractional unit price', () => {
    expect(() => invoiceTotals([{ description: 'x', qty: 0, unitExVatCents: 100 }])).toThrow(InvoiceRuleError);
    expect(() => invoiceTotals([{ description: 'x', qty: 1, unitExVatCents: 1.5 }])).toThrow(InvoiceRuleError);
  });

  it('formats an invoice number as the wireframe shows', () => {
    expect(nextInvoiceNumber(412)).toBe('INV-0412');
    expect(nextInvoiceNumber(7)).toBe('INV-0007');
    expect(() => nextInvoiceNumber(0)).toThrow(InvoiceRuleError);
  });
});
