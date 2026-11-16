import { describe, it, expect } from 'vitest';
import { ctr, rollup, totals } from './reporting.rules';

const impressions = (creativeId: string, n: number) =>
  Array.from({ length: n }, () => ({ creativeId, slotCode: 'A4', at: '2026-11-14T10:00:00.000Z' }));
const clicks = (creativeId: string, n: number) =>
  Array.from({ length: n }, () => ({ creativeId, at: '2026-11-14T10:00:00.000Z' }));

describe('ctr', () => {
  it('divides clicks by impressions, and is zero with no impressions', () => {
    expect(ctr(25, 100)).toBe(0.25);
    expect(ctr(0, 100)).toBe(0);
    expect(ctr(5, 0)).toBe(0);
  });
});

describe('rollup', () => {
  it('counts impressions and clicks per creative, most-served first', () => {
    const report = rollup([...impressions('c1', 10), ...impressions('c2', 30)], [...clicks('c1', 2)]);
    expect(report.map((r) => r.creativeId)).toEqual(['c2', 'c1']);
    expect(report[0]).toEqual({ creativeId: 'c2', impressions: 30, clicks: 0, ctr: 0 });
    expect(report[1]).toEqual({ creativeId: 'c1', impressions: 10, clicks: 2, ctr: 0.2 });
  });

  it('includes a creative with clicks but no impressions', () => {
    const report = rollup([], clicks('c9', 3));
    expect(report).toEqual([{ creativeId: 'c9', impressions: 0, clicks: 3, ctr: 0 }]);
  });

  it('is empty when there is no activity', () => {
    expect(rollup([], [])).toEqual([]);
  });
});

describe('totals', () => {
  it('sums the report and recomputes the overall ctr', () => {
    const report = rollup([...impressions('c1', 10), ...impressions('c2', 30)], [...clicks('c1', 2), ...clicks('c2', 8)]);
    expect(totals(report)).toEqual({ impressions: 40, clicks: 10, ctr: 0.25 });
  });

  it('is zero for an empty report', () => {
    expect(totals([])).toEqual({ impressions: 0, clicks: 0, ctr: 0 });
  });
});
