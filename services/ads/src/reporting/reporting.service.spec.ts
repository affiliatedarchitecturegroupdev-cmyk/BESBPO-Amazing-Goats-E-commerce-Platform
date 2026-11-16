import { describe, it, expect } from 'vitest';
import { ReportingService, REPORTING_STORE } from './reporting.service';
import { InMemoryReportingStore } from './reporting.store';
import { ClickRow, ImpressionRow } from './reporting.rules';

function service(impressionRows: ImpressionRow[] = [], clickRows: ClickRow[] = []) {
  return new ReportingService(new InMemoryReportingStore(impressionRows, clickRows));
}

describe('ReportingService', () => {
  it('returns empty totals when there is no activity', async () => {
    expect(await service().report()).toEqual({ totals: { impressions: 0, clicks: 0, ctr: 0 }, creatives: [] });
  });

  it('rolls impressions and clicks up per creative', async () => {
    const report = await service(
      [
        { creativeId: 'c1', slotCode: 'A4', at: '2026-11-14T10:00:00.000Z' },
        { creativeId: 'c1', slotCode: 'A4', at: '2026-11-14T10:00:00.000Z' },
        { creativeId: 'c2', slotCode: 'A1', at: '2026-11-14T10:00:00.000Z' },
      ],
      [{ creativeId: 'c1', at: '2026-11-14T10:05:00.000Z' }],
    ).report();
    expect(report.totals).toEqual({ impressions: 3, clicks: 1, ctr: 1 / 3 });
    expect(report.creatives.find((c) => c.creativeId === 'c1')).toEqual({
      creativeId: 'c1',
      impressions: 2,
      clicks: 1,
      ctr: 0.5,
    });
  });

  it('exposes the store token for wiring', () => {
    expect(typeof REPORTING_STORE).toBe('symbol');
  });
});
