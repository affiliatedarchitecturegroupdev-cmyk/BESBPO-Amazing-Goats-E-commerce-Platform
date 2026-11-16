import { ClickRow, ImpressionRow } from './reporting.rules';

/**
 * Persistence boundary for reporting. The in-memory store is the default so
 * tests and local runs need no database; the SQL adapter reads `ads.impressions`
 * and `ads.clicks` and is selected with `STORE_DRIVER=sql`.
 */
export interface ReportingStore {
  impressions(): Promise<ImpressionRow[]>;
  clicks(): Promise<ClickRow[]>;
}

/** In-memory rows, seeded for tests. */
export class InMemoryReportingStore implements ReportingStore {
  constructor(
    private readonly impressionRows: ImpressionRow[] = [],
    private readonly clickRows: ClickRow[] = [],
  ) {}

  async impressions(): Promise<ImpressionRow[]> {
    return [...this.impressionRows];
  }

  async clicks(): Promise<ClickRow[]> {
    return [...this.clickRows];
  }
}
