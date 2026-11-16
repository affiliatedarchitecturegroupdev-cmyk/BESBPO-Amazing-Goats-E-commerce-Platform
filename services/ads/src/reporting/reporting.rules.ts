/**
 * Reporting rollups (docs/06-ads.md). Impressions and clicks are recorded per
 * creative; the numbers an advertiser sees (impressions, clicks, click-through
 * rate) are pure functions of those rows, so the API, the advertiser portal and
 * a future export share one definition. No row here identifies a person: the
 * counters are keyed by creative and slot, never by the visitor.
 */

/** One served impression, as stored in `ads.impressions`. */
export interface ImpressionRow {
  creativeId: string;
  slotCode: string;
  at: string;
}

/** One click, as stored in `ads.clicks`. */
export interface ClickRow {
  creativeId: string;
  at: string;
}

/** A per-creative rollup. */
export interface CreativeReport {
  creativeId: string;
  impressions: number;
  clicks: number;
  /** Clicks divided by impressions, as a fraction; 0 when nothing was served. */
  ctr: number;
}

/** The whole report. */
export interface ReportTotals {
  impressions: number;
  clicks: number;
  ctr: number;
}

/** Click-through rate, guarded against a zero denominator. */
export function ctr(clicks: number, impressions: number): number {
  return impressions > 0 ? clicks / impressions : 0;
}

/**
 * Roll impressions and clicks up per creative, most-served first. A creative
 * with clicks but no impressions still appears (its impressions read 0).
 */
export function rollup(
  impressions: readonly ImpressionRow[],
  clicks: readonly ClickRow[],
): CreativeReport[] {
  const byCreative = new Map<string, { impressions: number; clicks: number }>();
  const bucket = (id: string) => {
    const found = byCreative.get(id);
    if (found) return found;
    const created = { impressions: 0, clicks: 0 };
    byCreative.set(id, created);
    return created;
  };

  for (const row of impressions) bucket(row.creativeId).impressions += 1;
  for (const row of clicks) bucket(row.creativeId).clicks += 1;

  return [...byCreative.entries()]
    .map(([creativeId, counts]) => ({
      creativeId,
      impressions: counts.impressions,
      clicks: counts.clicks,
      ctr: ctr(counts.clicks, counts.impressions),
    }))
    .sort((a, b) => b.impressions - a.impressions || a.creativeId.localeCompare(b.creativeId));
}

/** The totals across every creative in a report. */
export function totals(reports: readonly CreativeReport[]): ReportTotals {
  const impressions = reports.reduce((sum, r) => sum + r.impressions, 0);
  const clicks = reports.reduce((sum, r) => sum + r.clicks, 0);
  return { impressions, clicks, ctr: ctr(clicks, impressions) };
}
