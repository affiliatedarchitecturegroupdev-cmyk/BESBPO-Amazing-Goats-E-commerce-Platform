import { describe, it, expect } from 'vitest';
import { bandFor, evaluateReading, temperatureIncidents, TEMPERATURE_BANDS } from './temperature';
import type { TemperatureReading } from './temperature';

const reading = (celsius: number, at: string, subjectId = 'b1'): TemperatureReading => ({
  subjectType: 'batch',
  subjectId,
  celsius,
  at,
});

describe('TEMPERATURE_BANDS', () => {
  it('holds chilled at 0 to 4 and frozen at -18 or colder', () => {
    expect(TEMPERATURE_BANDS.chilled).toEqual({ minCelsius: 0, maxCelsius: 4 });
    expect(TEMPERATURE_BANDS.frozen.maxCelsius).toBe(-18);
  });
});

describe('evaluateReading', () => {
  it('returns null inside the band', () => {
    expect(evaluateReading(reading(2.5, '2026-02-01T08:00:00Z'), 'chilled')).toBeNull();
    expect(evaluateReading(reading(0, '2026-02-01T08:00:00Z'), 'chilled')).toBeNull();
    expect(evaluateReading(reading(4, '2026-02-01T08:00:00Z'), 'chilled')).toBeNull();
  });

  it('flags a warm breach with its deviation and severity', () => {
    const breach = evaluateReading(reading(9.5, '2026-02-01T08:00:00Z'), 'chilled');
    expect(breach).toMatchObject({
      kind: 'too_warm',
      deviationCelsius: 5.5,
      severity: 'critical',
      class: 'chilled',
    });
  });

  it('flags a cold breach and rounds the deviation', () => {
    const breach = evaluateReading(reading(-1.2, '2026-02-01T08:00:00Z'), 'chilled');
    expect(breach).toMatchObject({ kind: 'too_cold', deviationCelsius: 1.2, severity: 'warning' });
  });

  it('treats frozen as too cold only below -30', () => {
    expect(evaluateReading(reading(-19, '2026-02-01T08:00:00Z'), 'frozen')).toBeNull();
    expect(evaluateReading(reading(-31, '2026-02-01T08:00:00Z'), 'frozen')).toMatchObject({
      kind: 'too_cold',
    });
    expect(evaluateReading(reading(-10, '2026-02-01T08:00:00Z'), 'frozen')).toMatchObject({
      kind: 'too_warm',
      severity: 'critical',
    });
  });
});

describe('temperatureIncidents', () => {
  const classOf = () => 'chilled' as const;

  it('marks a single spike as not sustained', () => {
    const incidents = temperatureIncidents([reading(9, '2026-02-01T08:00:00Z')], classOf);
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      sustained: false,
      severity: 'critical',
      peakDeviationCelsius: 5,
    });
  });

  it('marks two breaches inside the window as sustained and critical', () => {
    const incidents = temperatureIncidents(
      [reading(6, '2026-02-01T08:00:00Z'), reading(7, '2026-02-01T08:20:00Z')],
      classOf,
    );
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      sustained: true,
      severity: 'critical',
      peakDeviationCelsius: 3,
    });
  });

  it('splits breaches that are further apart than the window', () => {
    const incidents = temperatureIncidents(
      [reading(6, '2026-02-01T08:00:00Z'), reading(6, '2026-02-01T11:00:00Z')],
      classOf,
      { windowMinutes: 60 },
    );
    expect(incidents).toHaveLength(2);
    expect(incidents.every((i) => !i.sustained)).toBe(true);
  });

  it('groups per subject and ignores readings inside the band', () => {
    const incidents = temperatureIncidents(
      [
        reading(2, '2026-02-01T08:00:00Z', 'b1'),
        reading(9, '2026-02-01T08:00:00Z', 'b1'),
        reading(9, '2026-02-01T08:00:00Z', 'b2'),
      ],
      classOf,
    );
    expect(incidents.map((i) => i.subjectId)).toEqual(['b1', 'b2']);
  });

  it('uses the caller-supplied class per subject', () => {
    const incidents = temperatureIncidents([reading(-19, '2026-02-01T08:00:00Z')], () => 'frozen');
    expect(incidents).toHaveLength(0);
  });
});
