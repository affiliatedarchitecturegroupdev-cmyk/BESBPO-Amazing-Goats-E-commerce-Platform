export const VAT_RATE_PERCENT = 15;
/** Prices are stored excluding VAT, in integer cents. */
export const addVat = (exCents: number, ratePercent: number = VAT_RATE_PERCENT): number =>
  Math.round((exCents * (100 + ratePercent)) / 100);
export const removeVat = (incCents: number, ratePercent: number = VAT_RATE_PERCENT): number =>
  Math.round((incCents * 100) / (100 + ratePercent));

/** Split an excluding-VAT amount into its VAT parts, at the given rate. */
export interface VatBreakdown {
  exVatCents: number;
  vatCents: number;
  incVatCents: number;
  ratePercent: number;
}

export function vatBreakdown(exVatCents: number, ratePercent: number = VAT_RATE_PERCENT): VatBreakdown {
  const incVatCents = addVat(exVatCents, ratePercent);
  return { exVatCents, vatCents: incVatCents - exVatCents, incVatCents, ratePercent };
}
