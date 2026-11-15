import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RefundsStore } from './refunds.store';
import { Refund } from './refunds.types';
import { approveRefund, markRefunded } from './refunds.rules';

export const REFUNDS_STORE = Symbol('REFUNDS_STORE');

@Injectable()
export class RefundsService {
  constructor(@Inject(REFUNDS_STORE) private readonly store: RefundsStore) {}

  async list(): Promise<Refund[]> {
    return (await this.store.all()).sort((a, b) => a.id.localeCompare(b.id));
  }

  async get(id: string): Promise<Refund> {
    const refund = await this.store.get(id);
    if (!refund) throw new NotFoundException(`unknown refund ${id}`);
    return refund;
  }

  /** Record a refund request. The requester is captured so approval can enforce four-eyes. */
  async request(refund: Omit<Refund, 'status'>): Promise<Refund> {
    return this.store.insert({ ...refund, status: 'requested' });
  }

  /** Approve a request; above the limit the approver must differ from the requester. */
  async approve(id: string, approverUserId: string): Promise<Refund> {
    const refund = await this.get(id);
    return this.store.replace(approveRefund(refund, approverUserId));
  }

  /** Mark an approved refund as paid out by the provider. */
  async markRefunded(id: string): Promise<Refund> {
    const refund = await this.get(id);
    return this.store.replace(markRefunded(refund));
  }
}
