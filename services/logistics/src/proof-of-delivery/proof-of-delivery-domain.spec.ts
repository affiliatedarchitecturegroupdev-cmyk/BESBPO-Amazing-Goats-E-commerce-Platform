import { describe, it, expect } from 'vitest';
import {
  MAX_PLAUSIBLE_CELSIUS,
  MIN_PLAUSIBLE_CELSIUS,
  isSameCapture,
  isTemperatureExcursion,
  judgeCapture,
  proofFromCapture,
} from './proof-of-delivery-domain';

describe('isTemperatureExcursion', () => {
  it('treats the chilled band as inclusive 0-4 °C', () => {
    expect(isTemperatureExcursion(0)).toBe(false);
    expect(isTemperatureExcursion(4)).toBe(false);
    expect(isTemperatureExcursion(4.1)).toBe(true);
    expect(isTemperatureExcursion(-0.1)).toBe(true);
  });

  it('judges against another class band when asked', () => {
    expect(isTemperatureExcursion(-19, 'frozen')).toBe(false);
    expect(isTemperatureExcursion(-12, 'frozen')).toBe(true);
  });
});

describe('judgeCapture', () => {
  it('accepts a clean chilled capture', () => {
    expect(judgeCapture({ signature: 'T. Dlamini', temperatureC: 3.4 })).toEqual({
      ok: true,
      problems: [],
      excursion: false,
    });
  });

  it('refuses a capture that proves nothing', () => {
    const check = judgeCapture({});
    expect(check.ok).toBe(false);
    expect(check.problems).toContain('no_evidence');
  });

  it('counts a photo, a recipient name or a probe reading as evidence', () => {
    expect(judgeCapture({ photoRef: 'photo-1' }).problems).toEqual([]);
    expect(judgeCapture({ recipientName: 'Nomsa' }).problems).toEqual([]);
    expect(judgeCapture({ temperatureC: 2 }).problems).toEqual([]);
  });

  it('treats a blank signature as no evidence', () => {
    expect(judgeCapture({ signature: '   ' }).problems).toContain('no_evidence');
  });

  it('rejects a reading no probe could have produced', () => {
    expect(judgeCapture({ temperatureC: MAX_PLAUSIBLE_CELSIUS + 1 }).problems).toContain(
      'implausible_temperature',
    );
    expect(judgeCapture({ temperatureC: MIN_PLAUSIBLE_CELSIUS - 1 }).problems).toContain(
      'implausible_temperature',
    );
    expect(judgeCapture({ temperatureC: Number.NaN }).problems).toContain('implausible_temperature');
  });

  it('rejects an unparseable captured-at rather than storing it', () => {
    expect(judgeCapture({ signature: 'x', capturedAt: 'not a date' }).problems).toContain(
      'invalid_captured_at',
    );
  });

  it('flags an excursion but still lets the evidence be stored', () => {
    const check = judgeCapture({ signature: 'T. Dlamini', temperatureC: 9.2 });
    expect(check.excursion).toBe(true);
    expect(check.ok).toBe(false);
    expect(check.problems).toEqual([]);
  });
});

describe('proofFromCapture', () => {
  const now = new Date('2026-11-18T07:15:00.000Z');

  it('defaults the capture time to the injected clock and trims the text', () => {
    const proof = proofFromCapture('s1', { signature: '  T. Dlamini ', recipientName: 'Nomsa ' }, 'chilled', now);
    expect(proof).toEqual({
      stopId: 's1',
      signature: 'T. Dlamini',
      recipientName: 'Nomsa',
      capturedAt: '2026-11-18T07:15:00.000Z',
    });
  });

  it('keeps the time the device recorded, so an offline capture is not re-stamped', () => {
    const proof = proofFromCapture('s1', { signature: 'x', capturedAt: '2026-11-18T06:40:00.000Z' }, 'chilled', now);
    expect(proof.capturedAt).toBe('2026-11-18T06:40:00.000Z');
  });

  it('records the excursion flag with the reading', () => {
    expect(proofFromCapture('s1', { temperatureC: 9.2 }, 'chilled', now)).toMatchObject({
      temperatureC: 9.2,
      temperatureExcursion: true,
    });
    expect(proofFromCapture('s1', { temperatureC: 3.4 }, 'chilled', now)).toMatchObject({
      temperatureC: 3.4,
      temperatureExcursion: false,
    });
  });

  it('omits the excursion flag entirely when there is no reading', () => {
    expect(proofFromCapture('s1', { signature: 'x' }, 'chilled', now)).not.toHaveProperty(
      'temperatureExcursion',
    );
  });
});

describe('isSameCapture', () => {
  it('matches on the stop and the capture time, the pair that makes a replay a no-op', () => {
    const a = { stopId: 's1', capturedAt: '2026-11-18T07:00:00.000Z' };
    expect(isSameCapture(a, { stopId: 's1', capturedAt: a.capturedAt })).toBe(true);
    expect(isSameCapture(a, { stopId: 's1', capturedAt: '2026-11-18T08:00:00.000Z' })).toBe(false);
    expect(isSameCapture(a, { stopId: 's2', capturedAt: a.capturedAt })).toBe(false);
  });
});
