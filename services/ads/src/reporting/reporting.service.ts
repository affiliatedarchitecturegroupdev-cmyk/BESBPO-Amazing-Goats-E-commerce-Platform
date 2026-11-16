import { Inject, Injectable } from '@nestjs/common';
import { ReportingStore } from './reporting.store';
import { CreativeReport, ReportTotals, rollup, totals } from './reporting.rules';

export const REPORTING_STORE = Symbol('REPORTING_STORE');

/** A full report: per-creative rows and the totals. */
export interface AdReport {
  totals: ReportTotals;
  creatives: CreativeReport[];
}

/**
 * Retail-media reporting. It reads the impression and click rows and rolls them
 * up with the pure rules, so the API and the advertiser portal show the same
 * numbers, computed one way.
 */
@Injectable()
export class ReportingService {
  constructor(@Inject(REPORTING_STORE) private readonly store: ReportingStore) {}

  async report(): Promise<AdReport> {
    const creatives = rollup(await this.store.impressions(), await this.store.clicks());
    return { totals: totals(creatives), creatives };
  }
}
