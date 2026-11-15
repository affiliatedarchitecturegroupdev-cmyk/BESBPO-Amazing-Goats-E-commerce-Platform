import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ReconciliationStore } from './reconciliation.store';
import { Settlement } from './reconciliation.types';
import { SettlementMatch, reconcileSettlement } from './reconciliation.rules';

export const RECONCILIATION_STORE = Symbol('RECONCILIATION_STORE');

@Injectable()
export class ReconciliationService {
  constructor(@Inject(RECONCILIATION_STORE) private readonly store: ReconciliationStore) {}

  /** Every settlement, so the finance screen can list them. */
  async list(): Promise<Settlement[]> {
    return this.store.settlements();
  }

  /** Reconcile one settlement against the bank and the payments it covers. */
  async reconcile(settlementId: string): Promise<SettlementMatch> {
    const settlement = (await this.store.settlements()).find((s) => s.id === settlementId);
    if (!settlement) throw new NotFoundException(`unknown settlement ${settlementId}`);
    const result = reconcileSettlement(
      settlement,
      await this.store.lines(),
      await this.store.knownPaymentIds(),
    );
    await this.store.markMatched(settlementId, result.matched);
    return result;
  }

  /** Reconcile every settlement, recording each outcome so a re-run is stable. */
  async runAll(): Promise<SettlementMatch[]> {
    const lines = await this.store.lines();
    const known = await this.store.knownPaymentIds();
    const results: SettlementMatch[] = [];
    for (const settlement of await this.store.settlements()) {
      const result = reconcileSettlement(settlement, lines, known);
      await this.store.markMatched(settlement.id, result.matched);
      results.push(result);
    }
    return results;
  }

  /** The settlements that did not reconcile, for an operator to chase. */
  async exceptions(): Promise<SettlementMatch[]> {
    return (await this.runAll()).filter((r) => !r.matched);
  }
}
