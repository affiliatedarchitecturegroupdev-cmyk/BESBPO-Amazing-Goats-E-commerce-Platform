import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  Creative,
  CreativeInput,
  draftCreative,
  reviewCreative,
} from '../campaigns/campaign-rules';
import { CreativesStore } from './creatives.store';

export const CREATIVES_STORE = Symbol('CREATIVES_STORE');

/**
 * Campaign creatives and their review. A creative starts pending review and a
 * named human decides it; the claim and health-claim gates live in the pure
 * rules, so the review queue and the API agree.
 */
@Injectable()
export class CreativesService {
  constructor(@Inject(CREATIVES_STORE) private readonly store: CreativesStore) {}

  async list(campaignId?: string): Promise<Creative[]> {
    return campaignId ? this.store.byCampaign(campaignId) : this.store.all();
  }

  async get(id: string): Promise<Creative> {
    const creative = await this.store.get(id);
    if (!creative) throw new NotFoundException(`unknown creative ${id}`);
    return creative;
  }

  async draft(input: CreativeInput): Promise<Creative> {
    return this.store.insert(draftCreative(randomUUID(), input));
  }

  /** The review queue: every creative still pending a decision. */
  async pending(): Promise<Creative[]> {
    return (await this.store.all()).filter((c) => c.reviewStatus === 'pending');
  }

  /** A named human approves or rejects; the rules enforce claims evidence. */
  async review(
    id: string,
    reviewerUserId: string,
    decision: 'approved' | 'rejected',
    notes?: string,
    at = new Date().toISOString(),
  ): Promise<Creative> {
    return this.store.replace(reviewCreative(await this.get(id), reviewerUserId, decision, at, notes));
  }
}
