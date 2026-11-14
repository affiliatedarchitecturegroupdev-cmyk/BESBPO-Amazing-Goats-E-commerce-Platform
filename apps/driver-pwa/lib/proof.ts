import type { Stop } from './daypack';

export interface ProofInput {
  stop: Stop;
  signatureDataUrl?: string;
  photoIds?: string[];
  celsius?: number;
  cashCents?: number;
}

export interface ProofCheck {
  ok: boolean;
  missing: string[];
}

/**
 * A drop is complete only when everything the stop needs is captured: a
 * signature where required, a probe reading for chilled goods, and the cash when
 * the customer pays on delivery.
 */
export function validateProof(input: ProofInput): ProofCheck {
  const missing: string[] = [];
  if (input.stop.requiresSignature && !input.signatureDataUrl) missing.push('signature');
  if (input.stop.temperature === 'chilled' && input.celsius === undefined) missing.push('temperature');
  if (input.stop.cashExpectedCents !== undefined && input.cashCents === undefined) missing.push('cash');
  return { ok: missing.length === 0, missing };
}

/** A chilled reading above this is out of the cold chain and must be flagged. */
export const CHILLED_MAX_CELSIUS = 4;

export function temperatureOutOfRange(celsius: number): boolean {
  return celsius > CHILLED_MAX_CELSIUS;
}

export function formatCelsius(celsius: number): string {
  return `${celsius.toFixed(1)}°C`;
}
