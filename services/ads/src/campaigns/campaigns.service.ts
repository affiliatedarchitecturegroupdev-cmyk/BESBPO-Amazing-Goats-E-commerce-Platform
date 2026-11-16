import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  Campaign,
  CampaignInput,
  approveCampaign,
  draftCampaign,
  endCampaign,
  pauseCampaign,
  rejectCampaign,
  submitForReview,
} from './campaign-rules';
import { CampaignsStore } from './campaigns.store';
import { CREATIVES_STORE } from '../creatives/creatives.service';
import { CreativesStore } from '../creatives/creatives.store';

export const CAMPAIGNS_STORE = Symbol('CAMPAIGNS_STORE');

/**
 * Advertiser campaigns. The service assigns identity and stores; every decision
 * (what is complete, who may approve, when a campaign may run) lives in the pure
 * rules, so the advertiser portal, the review queue and decisioning agree.
 */
@Injectable()
export class CampaignsService {
  constructor(
    @Inject(CAMPAIGNS_STORE) private readonly store: CampaignsStore,
    @Inject(CREATIVES_STORE) private readonly creatives: CreativesStore,
  ) {}

  async list(): Promise<Campaign[]> {
    return (await this.store.all()).sort((a, b) => b.id.localeCompare(a.id));
  }

  async get(id: string): Promise<Campaign> {
    const campaign = await this.store.get(id);
    if (!campaign) throw new NotFoundException(`unknown campaign ${id}`);
    return campaign;
  }

  async draft(input: CampaignInput): Promise<Campaign> {
    return this.store.insert(draftCampaign(randomUUID(), input));
  }

  /** Submit for human review; a campaign needs at least one creative. */
  async submit(id: string, at = new Date().toISOString()): Promise<Campaign> {
    const campaign = await this.get(id);
    const count = (await this.creatives.byCampaign(id)).length;
    return this.store.replace(submitForReview(campaign, count, at));
  }

  /** A named human approves. Nothing goes live without this. */
  async approve(id: string, reviewerUserId: string, at = new Date().toISOString()): Promise<Campaign> {
    return this.store.replace(approveCampaign(await this.get(id), reviewerUserId, at));
  }

  async reject(
    id: string,
    reviewerUserId: string,
    reason: string,
    at = new Date().toISOString(),
  ): Promise<Campaign> {
    return this.store.replace(rejectCampaign(await this.get(id), reviewerUserId, reason, at));
  }

  async pause(id: string): Promise<Campaign> {
    return this.store.replace(pauseCampaign(await this.get(id)));
  }

  async end(id: string, at = new Date().toISOString()): Promise<Campaign> {
    return this.store.replace(endCampaign(await this.get(id), at));
  }
}
