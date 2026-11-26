/** Standard SA VAT rate. The pricing service's list prices exclude VAT. */
export const STANDARD_VAT_RATE = 0.15;

export const formatRand = (cents: number): string => `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** VAT on an excluding-VAT amount, rounded to the cent as the cart does. */
export const addVat = (exVatCents: number, rate: number = STANDARD_VAT_RATE): number =>
  Math.round(exVatCents * (1 + rate));

/**
 * A price list price (excl. VAT) as the shopper pays it. The catalogue carries
 * the ex-VAT list price because that is what the cart and the order lines mean
 * by "price"; a displayed figure must be the VAT-inclusive one, because a South
 * African shelf price is the price the consumer pays. Rendering the raw value
 * would understate every product by 15%.
 */
export const formatRandIncVat = (exVatCents: number, rate: number = STANDARD_VAT_RATE): string =>
  formatRand(addVat(exVatCents, rate));
