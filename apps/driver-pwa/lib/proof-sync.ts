import type { ProofCaptureInput } from '@ag/api-client';
import type { QueuedEvent } from './offline-queue';

/**
 * Proof of delivery is captured as separate queued events on the stop screen
 * (`delivered` carries the signature, `temperature` the probe reading), because
 * each is its own offline action. The service wants one capture per stop, so
 * they are folded back together here, on the way out of the queue.
 */
export function captureFromEvents(events: QueuedEvent[]): ProofCaptureInput | undefined {
  const delivered = events.find((e) => e.type === 'delivered');
  const temperature = events.find((e) => e.type === 'temperature');
  const photoId = delivered?.type === 'delivered' ? delivered.photoIds?.[0] : undefined;
  const signature = delivered?.type === 'delivered' ? delivered.signatureDataUrl : undefined;

  if (!delivered && !temperature) return undefined;

  return {
    ...(signature ? { signature } : {}),
    ...(photoId ? { photoRef: photoId } : {}),
    ...(temperature?.type === 'temperature' ? { temperatureC: temperature.celsius } : {}),
    // The earliest event is when the driver actually reached the drop, so an
    // offline capture keeps the device's time rather than the sync time.
    ...(delivered || temperature
      ? {
          capturedAt: [delivered?.at, temperature?.at]
            .filter((at): at is string => Boolean(at))
            .sort()[0],
        }
      : {}),
  };
}

/**
 * One capture per stop, from a whole batch of queued events. A stop the driver
 * refused has no proof (nothing was dropped), so it is skipped.
 */
export function capturesByStop(events: QueuedEvent[]): { stopId: string; capture: ProofCaptureInput }[] {
  const refused = new Set(events.filter((e) => e.type === 'refused').map((e) => e.stopId));
  const byStop = new Map<string, QueuedEvent[]>();
  for (const event of events) {
    if (refused.has(event.stopId)) continue;
    const list = byStop.get(event.stopId) ?? [];
    list.push(event);
    byStop.set(event.stopId, list);
  }

  const out: { stopId: string; capture: ProofCaptureInput }[] = [];
  for (const [stopId, list] of byStop) {
    const capture = captureFromEvents(list);
    if (capture) out.push({ stopId, capture });
  }
  return out;
}
