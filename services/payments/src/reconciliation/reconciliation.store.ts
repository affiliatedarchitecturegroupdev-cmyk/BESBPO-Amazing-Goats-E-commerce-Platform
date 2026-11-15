import { Settlement, SettlementLine } from './reconciliation.types';

/**
 * Persistence boundary for reconciliation; the SQL adapter over
 * `payments.settlements` and `payments.settlement_lines` lands with the store swap.
 */
export interface ReconciliationStore {
  settlements(): Promise<Settlement[]>;
  lines(): Promise<SettlementLine[]>;
  /** The ids of the payments a settlement line may legitimately point at. */
  knownPaymentIds(): Promise<ReadonlySet<string>>;
  /** Record the outcome on the settlement, so a re-run does not re-report it. */
  markMatched(settlementId: string, matched: boolean): Promise<void>;
}

/** In-memory store used by tests and local runs until the SQL adapter is wired. */
export class InMemoryReconciliationStore implements ReconciliationStore {
  private readonly settlementRows: Settlement[];
  private readonly lineRows: SettlementLine[];
  private readonly paymentIds: Set<string>;

  constructor(
    settlements: Settlement[] = [],
    lines: SettlementLine[] = [],
    knownPaymentIds: Iterable<string> = [],
  ) {
    this.settlementRows = settlements.map((s) => ({ ...s }));
    this.lineRows = lines.map((l) => ({ ...l }));
    this.paymentIds = new Set(knownPaymentIds);
  }

  async settlements(): Promise<Settlement[]> {
    return this.settlementRows;
  }

  async lines(): Promise<SettlementLine[]> {
    return this.lineRows;
  }

  async knownPaymentIds(): Promise<ReadonlySet<string>> {
    return this.paymentIds;
  }

  async markMatched(settlementId: string, matched: boolean): Promise<void> {
    const row = this.settlementRows.find((s) => s.id === settlementId);
    if (row) row.matched = matched;
  }
}
