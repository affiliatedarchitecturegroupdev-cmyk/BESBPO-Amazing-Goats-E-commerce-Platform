import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PayoutsStore } from './payouts.store';
import { Payout } from './payouts.types';
import { approvePayout, freezePayout, markPaid } from './payouts.rules';

export const PAYOUTS_STORE = Symbol('PAYOUTS_STORE');

@Injectable()
export class PayoutsService {
  constructor(@Inject(PAYOUTS_STORE) private readonly store: PayoutsStore) {}

  async list(): Promise<Payout[]> {
    return (await this.store.all()).sort((a, b) => a.id.localeCompare(b.id));
  }

  async get(id: string): Promise<Payout> {
    const payout = await this.store.get(id);
    if (!payout) throw new NotFoundException(`unknown payout ${id}`);
    return payout;
  }

  /** Record a payout request. The requester is captured so approval can enforce four-eyes. */
  async request(payout: Omit<Payout, 'status'>): Promise<Payout> {
    return this.store.insert({ ...payout, status: 'requested' });
  }

  /** Approve a request; above the limit the approver must differ from the requester. */
  async approve(id: string, approverUserId: string): Promise<Payout> {
    const payout = await this.get(id);
    return this.store.replace(approvePayout(payout, approverUserId));
  }

  /** Mark an approved payout as paid by the provider. */
  async markPaid(id: string, at: Date = new Date()): Promise<Payout> {
    const payout = await this.get(id);
    return this.store.replace(markPaid(payout, at));
  }

  /** Freeze a payout that a chargeback has called into question. */
  async freeze(id: string): Promise<Payout> {
    const payout = await this.get(id);
    return this.store.replace(freezePayout(payout));
  }
}
