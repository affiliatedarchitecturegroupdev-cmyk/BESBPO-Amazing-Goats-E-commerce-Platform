import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CollectionsStore } from './collections.store';
import { CollectionActionRecord } from './collections.types';
import { dunningSchedule, dueActions, shouldHoldStandingOrders, DunningStep } from './dunning.rules';

export const COLLECTIONS_STORE = Symbol('COLLECTIONS_STORE');

/**
 * Collections. Scheduling comes from the pure `dunningSchedule` rule; the service
 * persists the plan and marks steps done. The account hold at day 14 is a rule
 * the caller (standing orders) reads via `shouldHold`.
 */
@Injectable()
export class CollectionsService {
  constructor(@Inject(COLLECTIONS_STORE) private readonly store: CollectionsStore) {}

  async list(): Promise<CollectionActionRecord[]> {
    return (await this.store.all()).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  }

  /** Plan the six dunning steps for an invoice from its due date. */
  async schedule(invoiceId: string, dueOn: string): Promise<CollectionActionRecord[]> {
    const actions = dunningSchedule(invoiceId, dueOn).map((a) => ({ ...a, id: randomUUID() }));
    return this.store.insertMany(actions);
  }

  /** The scheduled steps whose date has arrived by `asOf`. */
  async due(asOf: string): Promise<CollectionActionRecord[]> {
    return dueActions(await this.list(), asOf);
  }

  /** Record that a step was carried out by a user. */
  async markDone(id: string, byUser: string, doneAt: string): Promise<CollectionActionRecord> {
    const action = (await this.store.all()).find((a) => a.id === id);
    if (!action) throw new NotFoundException(`unknown collection action ${id}`);
    return this.store.replace({ ...action, doneAt, byUser });
  }

  /** The next step to run for an invoice at `asOf`, or undefined when none is due. */
  async nextStepFor(invoiceId: string, asOf: string): Promise<DunningStep | undefined> {
    const actions = (await this.list()).filter((a) => a.invoiceId === invoiceId && !a.doneAt);
    return dueActions(actions, asOf)[0]?.step;
  }

  /** Whether the account should be held (standing orders paused) at this overdue age. */
  shouldHold(daysOverdue: number): boolean {
    return shouldHoldStandingOrders(daysOverdue);
  }
}
