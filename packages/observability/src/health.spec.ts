import { describe, it, expect } from 'vitest';
import { healthHttpStatus, healthReport } from './health';

describe('healthReport', () => {
  it('is ok when there are no dependencies', () => {
    const report = healthReport({
      service: 'gateway',
      checkedAt: new Date('2026-02-01T08:00:00Z'),
    });
    expect(report).toEqual({
      status: 'ok',
      service: 'gateway',
      checkedAt: '2026-02-01T08:00:00.000Z',
      dependencies: [],
    });
  });

  it('is ok when every dependency is ok', () => {
    const report = healthReport({
      service: 'commerce',
      checkedAt: new Date('2026-02-01T08:00:00Z'),
      dependencies: [
        { name: 'postgres', ok: true },
        { name: 'redis', ok: true },
      ],
    });
    expect(report.status).toBe('ok');
  });

  it('is degraded when any dependency fails, and keeps the detail', () => {
    const report = healthReport({
      service: 'commerce',
      checkedAt: new Date('2026-02-01T08:00:00Z'),
      dependencies: [
        { name: 'postgres', ok: true },
        { name: 'redis', ok: false, detail: 'timeout' },
      ],
    });
    expect(report.status).toBe('degraded');
    expect(report.dependencies[1]).toEqual({ name: 'redis', ok: false, detail: 'timeout' });
  });

  it('includes the version when given', () => {
    const report = healthReport({
      service: 'gateway',
      version: '1.2.0',
      checkedAt: new Date('2026-02-01T08:00:00Z'),
    });
    expect(report.version).toBe('1.2.0');
  });
});

describe('healthHttpStatus', () => {
  it('is 200 when ok and 503 when degraded', () => {
    expect(healthHttpStatus({ status: 'ok', service: 's', checkedAt: '', dependencies: [] })).toBe(
      200,
    );
    expect(
      healthHttpStatus({ status: 'degraded', service: 's', checkedAt: '', dependencies: [] }),
    ).toBe(503);
  });
});
