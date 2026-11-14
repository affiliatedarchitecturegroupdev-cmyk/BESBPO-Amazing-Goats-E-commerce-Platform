/** Standard VAT rate for South Africa. The authoritative rate belongs to T-009 pricing. */
export const STANDARD_VAT_RATE = 0.15;

/** Round half-up to whole cents, so the VAT-inclusive total is always exact. */
export function roundCents(value: number): number {
  return Math.round(value + Number.EPSILON);
}
