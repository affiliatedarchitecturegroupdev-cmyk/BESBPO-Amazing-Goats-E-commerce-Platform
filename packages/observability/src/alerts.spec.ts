import { describe, it, expect } from 'vitest';
import {
  AlertRouter,
  InMemoryAlertSink,
  healthAlert,
  temperatureAlert,
  webhookPayload,
  WebhookAlertSink,
} from './alerts';
import type { TemperatureIncident } from './temperature';

const incident: TemperatureIncident = {
  subjectType: 'batch',
  subjectId: 'b1',
  class: 'chilled',
  breaches: [
    {
      subjectType: 'batch',
      subjectId: 'b1',
      celsius: 6,
      at: '2026-02-01T08:00:00Z',
      class: 'chilled',
      kind: 'too_warm',
      deviationCelsius: 2,
      severity: 'warning',
    },
    {
      subjectType: 'batch',
      subjectId: 'b1',
      celsius: 9,
      at: '2026-02-01T08:20:00Z',
      class: 'chilled',
      kind: 'too_warm',
      deviationCelsius: 5,
      severity: 'critical',
    },
  ],
  sustained: true,
  severity: 'critical',
  firstAt: '2026-02-01T08:00:00Z',
  lastAt: '2026-02-01T08:20:00Z',
  peakDeviationCelsius: 5,
};

describe('temperatureAlert', () => {
  it('names the subject, the peak and the action, and is critical when sustained', () => {
    const alert = temperatureAlert(incident);
    expect(alert).toMatchObject({
      key: 'temperature:batch:b1',
      severity: 'critical',
      at: '2026-02-01T08:20:00Z',
    });
    expect(alert.title).toContain('batch b1');
    expect(alert.detail).toContain('peak 5 °C out');
    expect(alert.detail).toContain('block the batch from sale');
    expect(alert.labels).toMatchObject({ alertname: 'ColdChainBreach', sustained: 'true' });
  });

  it('asks for an investigation when a single reading is outside the band', () => {
    const alert = temperatureAlert({ ...incident, sustained: false, severity: 'warning' });
    expect(alert.detail).toContain('re-check the probe');
  });
});

describe('healthAlert', () => {
  it('is critical and carries the service and path', () => {
    const alert = healthAlert('commerce', '/health', new Date('2026-02-01T08:00:00Z'));
    expect(alert).toMatchObject({
      key: 'health:commerce',
      severity: 'critical',
      at: '2026-02-01T08:00:00.000Z',
    });
    expect(alert.labels).toMatchObject({ service: 'commerce', path: '/health' });
  });
});

describe('AlertRouter', () => {
  it('sends the first alert and suppresses a repeat at the same severity', async () => {
    const sink = new InMemoryAlertSink();
    const router = new AlertRouter(sink);
    const alert = temperatureAlert(incident);
    expect(await router.raise(alert)).toBe(true);
    expect(await router.raise(alert)).toBe(false);
    expect(sink.sent).toHaveLength(1);
  });

  it('re-fires when the severity changes', async () => {
    const sink = new InMemoryAlertSink();
    const router = new AlertRouter(sink);
    await router.raise(temperatureAlert({ ...incident, sustained: false, severity: 'warning' }));
    await router.raise(temperatureAlert(incident));
    expect(sink.sent.map((a) => a.severity)).toEqual(['warning', 'critical']);
  });

  it('clears a resolved alert so it can fire again', async () => {
    const sink = new InMemoryAlertSink();
    const router = new AlertRouter(sink);
    const alert = temperatureAlert(incident);
    await router.raise(alert);
    expect(router.isOpen(alert.key)).toBe(true);
    router.resolve(alert.key);
    expect(router.isOpen(alert.key)).toBe(false);
    expect(await router.raise(alert)).toBe(true);
    expect(sink.sent).toHaveLength(2);
  });
});

describe('webhookPayload', () => {
  it('renders a stable, small payload for a notification webhook', () => {
    const payload = webhookPayload(temperatureAlert(incident));
    expect(payload).toMatchObject({
      version: '1',
      alert_key: 'temperature:batch:b1',
      severity: 'critical',
    });
    expect(Object.keys(payload).sort()).toEqual([
      'alert_key',
      'at',
      'detail',
      'labels',
      'severity',
      'title',
      'version',
    ]);
  });
});

describe('WebhookAlertSink', () => {
  it('POSTs the payload with the secret header', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;

    const sink = new WebhookAlertSink({
      url: 'https://hooks.example.com/alerts',
      secret: 's3cr3t',
      fetchFn,
    });
    await sink.send(temperatureAlert(incident));

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://hooks.example.com/alerts');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['x-ag-alert-secret']).toBe('s3cr3t');
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({
      alert_key: 'temperature:batch:b1',
    });
  });

  it('omits the secret header when no secret is configured', async () => {
    let headers: Record<string, string> = {};
    const fetchFn = (async (_url: string, init: RequestInit) => {
      headers = init.headers as Record<string, string>;
      return new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;

    await new WebhookAlertSink({ url: 'https://hooks.example.com/alerts', fetchFn }).send(
      healthAlert('stock', '/health', new Date()),
    );
    expect(headers['x-ag-alert-secret']).toBeUndefined();
    expect(headers['content-type']).toBe('application/json');
  });

  it('swallows a transport failure so alerting never breaks the caller', async () => {
    const fetchFn = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const sink = new WebhookAlertSink({ url: 'https://hooks.example.com/alerts', fetchFn });
    await expect(sink.send(temperatureAlert(incident))).resolves.toBeUndefined();
  });
});
