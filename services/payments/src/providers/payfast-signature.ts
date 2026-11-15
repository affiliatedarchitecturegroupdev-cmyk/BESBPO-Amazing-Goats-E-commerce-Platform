import { createHash } from 'node:crypto';

/**
 * A PayFast field list. Order matters: PayFast signs the pairs in the order the
 * fields appear in its integration, not alphabetically (its API signature is a
 * different scheme). Keep this an array of tuples rather than an object so the
 * order is explicit and stable.
 */
export type PayFastFields = readonly (readonly [string, string])[];

/**
 * Builds the string PayFast signs: every non-blank `name=urlencoded(value)` pair
 * in the given order, joined with `&`, with the passphrase appended as a final
 * `passphrase=` pair. Encoding matches PHP's `urlencode` (spaces become `+`),
 * which is what PayFast's own examples use.
 */
export function signatureString(fields: PayFastFields, passphrase: string): string {
  const pairs = fields
    .filter(([, value]) => value !== '' && value !== undefined && value !== null)
    .map(([name, value]) => `${name}=${urlencode(String(value).trim())}`);
  if (passphrase) pairs.push(`passphrase=${urlencode(passphrase)}`);
  return pairs.join('&');
}

function urlencode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

/** PayFast signs with an MD5 hash, lower case. */
export function payfastSignature(fields: PayFastFields, passphrase: string): string {
  return createHash('md5').update(signatureString(fields, passphrase)).digest('hex');
}

/**
 * Verifies an ITN signature over the posted form fields. The `signature` field
 * itself is excluded from the signed string; every other field is included in the
 * order received. Comparison is a plain string compare because MD5 of a public
 * string leaks nothing of value to a timing observer.
 */
export function verifyItnSignature(
  posted: PayFastFields,
  passphrase: string,
  signature: string | undefined,
): boolean {
  if (!signature) return false;
  const signed = posted.filter(([name]) => name !== 'signature');
  return payfastSignature(signed, passphrase) === signature.trim().toLowerCase();
}

/** PayFast's coarse payment status vocabulary. */
export type PayFastStatus = 'COMPLETE' | 'CANCELLED' | 'PENDING' | 'FAILED';

export function mapPayFastStatus(status: string): 'succeeded' | 'cancelled' | 'failed' | 'pending' {
  switch (status.toUpperCase()) {
    case 'COMPLETE':
      return 'succeeded';
    case 'CANCELLED':
      return 'cancelled';
    case 'FAILED':
      return 'failed';
    default:
      return 'pending';
  }
}

/** PayFast sends a decimal ZAR amount; the platform works in integer cents. */
export function centsFromZar(amount: string | number | undefined): number | undefined {
  if (amount === undefined || amount === '') return undefined;
  const value = Number(amount);
  if (!Number.isFinite(value)) return undefined;
  return Math.round(value * 100);
}
