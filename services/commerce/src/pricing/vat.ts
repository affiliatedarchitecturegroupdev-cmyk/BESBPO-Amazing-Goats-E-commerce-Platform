export const VAT_RATE_PERCENT = 15;
/** Prices are stored excluding VAT, in integer cents. */
export const addVat = (exCents: number): number => Math.round((exCents * (100 + VAT_RATE_PERCENT)) / 100);
export const removeVat = (incCents: number): number => Math.round((incCents * 100) / (100 + VAT_RATE_PERCENT));
