/**
 * Proof of delivery, as the driver app captures it on the stop screen
 * (`dr-proof`). One proof per stop: the driver signs, photographs the drop and
 * records the probe reading, and the row is the evidence behind a `delivered`
 * status. Matches `logistics.proof_of_delivery`.
 */
export interface ProofOfDelivery {
  /** The stop's domain id, which is also the idempotency key for the capture. */
  stopId: string;
  /** Typed name or a signature data URL. */
  signature?: string;
  /** Reference to an uploaded photo, never the bytes. */
  photoRef?: string;
  /** Probe reading in Celsius, from the Bluetooth probe at the stop. */
  temperatureC?: number;
  /** True when the reading fell outside the cold-chain band, so it is auditable. */
  temperatureExcursion?: boolean;
  capturedAt: string;
  recipientName?: string;
}

/** What the driver app posts for a stop; everything but the time is optional. */
export interface CaptureInput {
  signature?: string;
  photoRef?: string;
  temperatureC?: number;
  capturedAt?: string;
  recipientName?: string;
}

/** Why a capture was refused, so the app can tell the driver what to fix. */
export type CaptureProblem =
  | 'no_evidence'
  | 'implausible_temperature'
  | 'invalid_captured_at';

export interface CaptureCheck {
  ok: boolean;
  problems: CaptureProblem[];
  /** The reading was plausible but outside the cold chain: store it, flag it. */
  excursion: boolean;
}
