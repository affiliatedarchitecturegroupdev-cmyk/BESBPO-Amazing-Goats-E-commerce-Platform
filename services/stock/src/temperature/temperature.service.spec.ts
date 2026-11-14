import { describe, it, expect } from 'vitest';
import { InMemoryAlertSink } from '@ag/observability';
import { TemperatureService } from './temperature.service';
import { InMemoryTemperatureStore } from './temperature.types';
import { InMemorySubjectClassSource } from './temperature.store';

const make = (classes: Record<string, 'chilled' | 'frozen' | 'live' | 'ambient'> = {}) => {
  const store = new InMemoryTemperatureStore();
  const sink = new InMemoryAlertSink();
  const service = new TemperatureService(store, new InMemorySubjectClassSource(classes), sink);
  return { service, sink };
};

describe('TemperatureService', () => {
  it('starts empty', async () => {
    const { service } = make();
    expect(await service.list()).toEqual([]);
  });

  it('records readings and lists them newest first', async () => {
    const { service } = make();
    await service.record([
      { subjectType: 'batch', subjectId: 'b1', celsius: 2, at: '2026-02-01T08:00:00Z' },
      { subjectType: 'batch', subjectId: 'b1', celsius: 3, at: '2026-02-01T09:00:00Z' },
    ]);
    const rows = await service.list({ subjectId: 'b1' });
    expect(rows.map((r) => r.at)).toEqual(['2026-02-01T09:00:00Z', '2026-02-01T08:00:00Z']);
  });

  it('raises one alert for a sustained chilled breach', async () => {
    const { service, sink } = make({ b1: 'chilled' });
    const result = await service.record([
      { subjectType: 'batch', subjectId: 'b1', celsius: 6, at: '2026-02-01T08:00:00Z' },
      { subjectType: 'batch', subjectId: 'b1', celsius: 9, at: '2026-02-01T08:20:00Z' },
    ]);
    expect(result).toEqual({ incidents: 1, alertsRaised: 1 });
    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0]).toMatchObject({ key: 'temperature:batch:b1', severity: 'critical' });
    expect(sink.sent[0].labels).toMatchObject({ alertname: 'ColdChainBreach', sustained: 'true' });
  });

  it('does not alert when readings are inside the band', async () => {
    const { service, sink } = make({ b1: 'chilled' });
    const result = await service.record([
      { subjectType: 'batch', subjectId: 'b1', celsius: 2, at: '2026-02-01T08:00:00Z' },
      { subjectType: 'batch', subjectId: 'b1', celsius: 3.5, at: '2026-02-01T08:20:00Z' },
    ]);
    expect(result).toEqual({ incidents: 0, alertsRaised: 0 });
    expect(sink.sent).toEqual([]);
  });

  it('suppresses a repeat alert for the same subject at the same severity', async () => {
    const { service, sink } = make({ b1: 'chilled' });
    await service.record([
      { subjectType: 'batch', subjectId: 'b1', celsius: 6, at: '2026-02-01T08:00:00Z' },
      { subjectType: 'batch', subjectId: 'b1', celsius: 7, at: '2026-02-01T08:10:00Z' },
    ]);
    const second = await service.record([
      { subjectType: 'batch', subjectId: 'b1', celsius: 8, at: '2026-02-01T08:20:00Z' },
    ]);
    expect(second).toEqual({ incidents: 1, alertsRaised: 0 });
    expect(sink.sent).toHaveLength(1);
  });

  it('falls back to the chilled band for an unknown subject', async () => {
    const { service, sink } = make();
    await service.record([
      { subjectType: 'batch', subjectId: 'unknown', celsius: 8, at: '2026-02-01T08:00:00Z' },
      { subjectType: 'batch', subjectId: 'unknown', celsius: 9, at: '2026-02-01T08:10:00Z' },
    ]);
    expect(sink.sent[0].labels.temperature_class).toBe('chilled');
  });

  it('re-evaluates stored readings on demand', async () => {
    const store = new InMemoryTemperatureStore();
    const firstSink = new InMemoryAlertSink();
    await new TemperatureService(
      store,
      new InMemorySubjectClassSource({ b1: 'chilled' }),
      firstSink,
    ).record([{ subjectType: 'batch', subjectId: 'b1', celsius: 9, at: '2026-02-01T08:00:00Z' }]);

    // A fresh service over the same store re-checks what was persisted.
    const sink = new InMemoryAlertSink();
    const result = await new TemperatureService(
      store,
      new InMemorySubjectClassSource({ b1: 'chilled' }),
      sink,
    ).evaluateAll();
    expect(result).toEqual({ incidents: 1, alertsRaised: 1 });
    expect(sink.sent).toHaveLength(1);
  });
});
