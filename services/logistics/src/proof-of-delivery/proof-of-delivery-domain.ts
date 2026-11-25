import { evaluateReading, type TemperatureClass } from '@ag/observability';
import { CaptureCheck, CaptureInput, CaptureProblem, ProofOfDelivery } from './proof-of-delivery.types';

/**
 * Proof-of-delivery rules (T-065). Pure functions, so the driver's capture is
 * judged the same way in the app, in the service and in a test, with no
 * database and no clock of its own.
 */

/**
 * A probe reading outside this is a broken probe or a mis-keyed number, not a
 * cold chain event: no delivery in the platform's range is ever this far from
 * ambient, so storing it would corrupt the temperature audit trail.
 */
export const MIN_PLAUSIBLE_CELSIUS = -60;
export const MAX_PLAUSIBLE_CELSIUS = 60;

/**
 * A proof with no evidence at all proves nothing. A signature, a photo, a
 * recipient name or a probe reading each count; a bare timestamp does not.
 */
function hasEvidence(input: CaptureInput): boolean {
  return (
    Boolean(input.signature?.trim()) ||
    Boolean(input.photoRef?.trim()) ||
    Boolean(input.recipientName?.trim()) ||
    input.temperatureC !== undefined
  );
}

function isPlausibleTemperature(celsius: number): boolean {
  return (
    Number.isFinite(celsius) &&
    celsius >= MIN_PLAUSIBLE_CELSIUS &&
    celsius <= MAX_PLAUSIBLE_CELSIUS
  );
}

/**
 * Whether a reading is outside its class band. Delegates to the shared
 * cold-chain bands (`packages/observability`), so the driver's stop screen, the
 * stock temperature service and this rule cannot disagree about 0-4 °C.
 */
export function isTemperatureExcursion(celsius: number, cls: TemperatureClass = 'chilled'): boolean {
  return (
    evaluateReading(
      { subjectType: 'stop', subjectId: '', celsius, at: new Date(0).toISOString() },
      cls,
    ) !== null
  );
}

/**
 * Judge a capture before it is stored. Two kinds of failure are told apart:
 *
 * - `problems` are refusals. A proof with no evidence, or a reading a probe
 *   could not have produced, is rejected outright.
 * - `excursion` is a real cold-chain event. The reading is plausible, so the
 *   capture is recorded and flagged rather than thrown away: refusing it would
 *   destroy the evidence R638 requires and would leave the driver's queue
 *   retrying a capture that can never succeed. `ok` is still false, so the app
 *   warns the driver that the drop was not a clean one.
 */
export function judgeCapture(
  input: CaptureInput,
  cls: TemperatureClass = 'chilled',
): CaptureCheck {
  const problems: CaptureProblem[] = [];

  if (!hasEvidence(input)) problems.push('no_evidence');
  if (input.temperatureC !== undefined && !isPlausibleTemperature(input.temperatureC)) {
    problems.push('implausible_temperature');
  }
  if (input.capturedAt !== undefined && Number.isNaN(Date.parse(input.capturedAt))) {
    problems.push('invalid_captured_at');
  }

  const excursion =
    input.temperatureC !== undefined &&
    isPlausibleTemperature(input.temperatureC) &&
    isTemperatureExcursion(input.temperatureC, cls);

  return { ok: problems.length === 0 && !excursion, problems, excursion };
}

/**
 * Build the stored record from a capture. `capturedAt` defaults to the clock
 * the caller passes in, so the service and its tests agree on the time.
 */
export function proofFromCapture(
  stopId: string,
  input: CaptureInput,
  cls: TemperatureClass = 'chilled',
  now: Date = new Date(),
): ProofOfDelivery {
  const excursion =
    input.temperatureC !== undefined && isTemperatureExcursion(input.temperatureC, cls);

  return {
    stopId,
    ...(input.signature?.trim() ? { signature: input.signature.trim() } : {}),
    ...(input.photoRef?.trim() ? { photoRef: input.photoRef.trim() } : {}),
    ...(input.temperatureC !== undefined ? { temperatureC: input.temperatureC } : {}),
    ...(input.temperatureC !== undefined ? { temperatureExcursion: excursion } : {}),
    capturedAt: input.capturedAt ?? now.toISOString(),
    ...(input.recipientName?.trim() ? { recipientName: input.recipientName.trim() } : {}),
  };
}

/**
 * A stop is proved once. A second capture for the same stop is the same
 * delivery, so the first record wins and a replay is a no-op.
 */
export function isSameCapture(a: ProofOfDelivery, b: ProofOfDelivery): boolean {
  return a.stopId === b.stopId && a.capturedAt === b.capturedAt;
}
