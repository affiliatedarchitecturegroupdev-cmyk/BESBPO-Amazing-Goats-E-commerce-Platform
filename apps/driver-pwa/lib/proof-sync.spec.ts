import { describe, it, expect } from 'vitest';
import { captureFromEvents, capturesByStop } from './proof-sync';
import type { QueuedEvent } from './offline-queue';

const delivered = (over: Partial<Extract<QueuedEvent, { type: 'delivered' }>> = {}): QueuedEvent => ({
  type: 'delivered', id: 'e1', stopId: 's1', at: '2026-11-18T06:10:00Z',
  signatureDataUrl: 'data:image/png;base64,abc', ...over,
});
const temperature = (over: Partial<Extract<QueuedEvent, { type: 'temperature' }>> = {}): QueuedEvent => ({
  type: 'temperature', id: 'e2', stopId: 's1', at: '2026-11-18T06:05:00Z', celsius: 3.4, ...over,
});

describe('captureFromEvents', () => {
  it('folds the signature, photo and probe reading into one capture', () => {
    expect(
      captureFromEvents([delivered({ photoIds: ['p1'] }), temperature()]),
    ).toEqual({
      signature: 'data:image/png;base64,abc',
      photoRef: 'p1',
      temperatureC: 3.4,
      capturedAt: '2026-11-18T06:05:00Z',
    });
  });

  it('keeps the earliest time, so an offline capture is not re-stamped with the sync time', () => {
    const capture = captureFromEvents([
      delivered({ at: '2026-11-18T06:10:00Z' }),
      temperature({ at: '2026-11-18T06:05:00Z' }),
    ]);
    expect(capture?.capturedAt).toBe('2026-11-18T06:05:00Z');
  });

  it('builds a capture from a probe reading alone', () => {
    expect(captureFromEvents([temperature()])).toEqual({
      temperatureC: 3.4,
      capturedAt: '2026-11-18T06:05:00Z',
    });
  });

  it('has no capture when nothing proves the drop', () => {
    expect(captureFromEvents([{ type: 'arrived', id: 'e0', stopId: 's1', at: '2026-11-18T06:00:00Z' }])).toBeUndefined();
  });

  it('omits a photo ref when the driver took no photo', () => {
    expect(captureFromEvents([delivered()])).not.toHaveProperty('photoRef');
  });
});

describe('capturesByStop', () => {
  it('makes one capture per stop from a whole batch', () => {
    const captures = capturesByStop([
      delivered({ stopId: 's1' }),
      temperature({ stopId: 's1' }),
      delivered({ id: 'e3', stopId: 's2', at: '2026-11-18T07:00:00Z' }),
    ]);
    expect(captures.map((c) => c.stopId)).toEqual(['s1', 's2']);
    expect(captures[0].capture.temperatureC).toBe(3.4);
    expect(captures[1].capture).not.toHaveProperty('temperatureC');
  });

  it('skips a stop the driver refused, because nothing was dropped', () => {
    const captures = capturesByStop([
      { type: 'refused', id: 'e9', stopId: 's3', at: '2026-11-18T08:00:00Z', reason: 'nobody home' },
      delivered({ stopId: 's3' }),
    ]);
    expect(captures).toEqual([]);
  });

  it('has nothing to send for an empty batch', () => {
    expect(capturesByStop([])).toEqual([]);
  });
});
