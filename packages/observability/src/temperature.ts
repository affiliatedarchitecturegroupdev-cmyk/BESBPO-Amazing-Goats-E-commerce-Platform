/**
 * Cold-chain temperature monitoring (task T-034). Chilled and frozen stock must
 * stay within its class band; a reading outside the band is a breach that must
 * be alerted and, for a sustained breach, block the batch from sale.
 *
 * `inventory.temperature_logs` stores `(subject_type, subject_id, celsius, at)`.
 * The rules are pure functions so they can be tested directly, independent of
 * Postgres and of the alert transport.
 */

export type TemperatureClass = 'live' | 'chilled' | 'frozen' | 'ambient';

export interface TemperatureBand {
  minCelsius: number;
  maxCelsius: number;
}

/**
 * The safe band per class. Chilled meat is held at 0 to 4 °C (docs/04), frozen
 * at -18 °C or colder, live animals and ambient stock are not cold-chain. The
 * frozen band has a wide lower bound because colder is safer.
 */
export const TEMPERATURE_BANDS: Record<TemperatureClass, TemperatureBand> = {
  chilled: { minCelsius: 0, maxCelsius: 4 },
  frozen: { minCelsius: -30, maxCelsius: -18 },
  live: { minCelsius: -5, maxCelsius: 45 },
  ambient: { minCelsius: -5, maxCelsius: 35 },
};

export interface TemperatureReading {
  subjectType: string;
  subjectId: string;
  celsius: number;
  at: string;
  source?: string;
}

export type BreachKind = 'too_warm' | 'too_cold';

export interface TemperatureBreach {
  subjectType: string;
  subjectId: string;
  celsius: number;
  at: string;
  class: TemperatureClass;
  kind: BreachKind;
  /** How far outside the band, in degrees (always positive). */
  deviationCelsius: number;
  severity: 'warning' | 'critical';
}

/** The band for a class; live and ambient stock are effectively not cold-chain. */
export function bandFor(cls: TemperatureClass): TemperatureBand {
  return TEMPERATURE_BANDS[cls];
}

/**
 * Judge one reading against a class band. Returns a breach when the reading is
 * outside the band, otherwise null. Severity is critical when the reading is
 * more than two degrees outside the band, warning otherwise.
 */
export function evaluateReading(
  reading: TemperatureReading,
  cls: TemperatureClass,
): TemperatureBreach | null {
  const band = bandFor(cls);
  const deviation =
    reading.celsius < band.minCelsius
      ? band.minCelsius - reading.celsius
      : reading.celsius > band.maxCelsius
        ? reading.celsius - band.maxCelsius
        : 0;
  if (deviation === 0) return null;

  return {
    subjectType: reading.subjectType,
    subjectId: reading.subjectId,
    celsius: reading.celsius,
    at: reading.at,
    class: cls,
    kind: reading.celsius > band.maxCelsius ? 'too_warm' : 'too_cold',
    deviationCelsius: Math.round(deviation * 10) / 10,
    severity: deviation > 2 ? 'critical' : 'warning',
  };
}

/**
 * A sustained breach is two or more readings outside the band for the same
 * subject within the window. One spike is a warning to investigate; two in a
 * row is a real cold-chain failure that must block the batch.
 */
export interface SustainedBreachOptions {
  /** Only readings this many minutes apart or closer count as one incident. */
  windowMinutes?: number;
  /** How many breaches in the window make the incident sustained. */
  threshold?: number;
}

export interface TemperatureIncident {
  subjectType: string;
  subjectId: string;
  class: TemperatureClass;
  breaches: TemperatureBreach[];
  sustained: boolean;
  severity: 'warning' | 'critical';
  firstAt: string;
  lastAt: string;
  /** Highest deviation seen in the incident. */
  peakDeviationCelsius: number;
}

const minutesBetween = (a: string, b: string): number =>
  Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60000;

/**
 * Group breaches per subject into incidents and mark an incident sustained when
 * it holds `threshold` (default 2) or more breaches inside `windowMinutes`
 * (default 60). Readings are judged against `classOf`, so the caller maps a
 * subject to its temperature class (the batch's variant).
 */
export function temperatureIncidents(
  readings: TemperatureReading[],
  classOf: (subjectType: string, subjectId: string) => TemperatureClass,
  options: SustainedBreachOptions = {},
): TemperatureIncident[] {
  const window = options.windowMinutes ?? 60;
  const threshold = options.threshold ?? 2;

  const breaches = readings
    .map((r) => evaluateReading(r, classOf(r.subjectType, r.subjectId)))
    .filter((b): b is TemperatureBreach => b !== null)
    .sort((a, b) => a.at.localeCompare(b.at));

  const bySubject = new Map<string, TemperatureBreach[]>();
  for (const breach of breaches) {
    const key = `${breach.subjectType}\u0000${breach.subjectId}`;
    const list = bySubject.get(key) ?? [];
    list.push(breach);
    bySubject.set(key, list);
  }

  const incidents: TemperatureIncident[] = [];
  for (const list of bySubject.values()) {
    let group: TemperatureBreach[] = [];
    const flush = () => {
      if (group.length === 0) return;
      const sustained = group.length >= threshold;
      const peak = Math.max(...group.map((b) => b.deviationCelsius));
      incidents.push({
        subjectType: group[0].subjectType,
        subjectId: group[0].subjectId,
        class: group[0].class,
        breaches: group,
        sustained,
        severity:
          sustained || group.some((b) => b.severity === 'critical') ? 'critical' : 'warning',
        firstAt: group[0].at,
        lastAt: group[group.length - 1].at,
        peakDeviationCelsius: peak,
      });
      group = [];
    };

    for (const breach of list) {
      if (group.length > 0 && minutesBetween(group[group.length - 1].at, breach.at) > window)
        flush();
      group.push(breach);
    }
    flush();
  }

  return incidents.sort((a, b) => a.firstAt.localeCompare(b.firstAt));
}
