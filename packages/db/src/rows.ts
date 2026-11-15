/**
 * Row-mapping helpers. `node-postgres` returns `bigint` as a string (to avoid
 * precision loss) and `timestamptz` as a `Date`, but the domain types use integer
 * cents and ISO strings, so every adapter maps rows through these rather than
 * reading raw driver values.
 */

/** A money column (`bigint`) to integer cents. */
export function toCents(value: unknown): number {
  return typeof value === 'string' ? Number(value) : (value as number);
}

/** A nullable money column to integer cents, or undefined. */
export function toCentsOrUndefined(value: unknown): number | undefined {
  return value === null || value === undefined ? undefined : toCents(value);
}

/** A `timestamptz` column to an ISO string. */
export function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** A nullable `timestamptz` column to an ISO string, or undefined. */
export function toIsoOrUndefined(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : toIso(value);
}
