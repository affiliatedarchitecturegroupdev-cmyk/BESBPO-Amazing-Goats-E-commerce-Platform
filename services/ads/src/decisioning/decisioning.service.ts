import { Inject, Injectable } from '@nestjs/common';
import { AdPlacement, serveAds } from './serve-ads';
import { FrequencyStore } from './frequency.store';
import { CampaignsStore } from '../campaigns/campaigns.store';
import { CreativesStore } from '../creatives/creatives.store';
import { CAMPAIGNS_STORE } from '../campaigns/campaigns.service';
import { CREATIVES_STORE } from '../creatives/creatives.service';

export const FREQUENCY_STORE = Symbol('FREQUENCY_STORE');

export interface ServeRequest {
  slot: string;
  category?: string;
  maxAds?: number;
  /** A stable, non-identifying hash of the visitor, for frequency caps. */
  userHash?: string;
}

/**
 * Retail-media decisioning. It reads the campaign and creative stores, then
 * serves through the tested `serveAds` rule, so an ad only shows when its
 * campaign may run and every served ad carries the Sponsored label.
 */
@Injectable()
export class DecisioningService {
  constructor(
    @Inject(CAMPAIGNS_STORE) private readonly campaigns: CampaignsStore,
    @Inject(CREATIVES_STORE) private readonly creatives: CreativesStore,
    @Inject(FREQUENCY_STORE) private readonly frequency: FrequencyStore,
  ) {}

  async serve(request: ServeRequest): Promise<AdPlacement[]> {
    const campaigns = await this.campaigns.all();
    const creatives = await this.creatives.all();
    const impressions: Record<string, number> = {};
    if (request.userHash) {
      for (const creative of creatives) {
        const count = await this.frequency.impressionsFor(request.userHash, creative.id);
        if (count > 0) impressions[creative.id] = count;
      }
    }
    const ads = serveAds({
      campaigns,
      creatives,
      slot: request.slot,
      category: request.category,
      maxAds: request.maxAds,
      impressions,
    });
    // Record what was shown, so the next request counts against the cap.
    if (request.userHash) {
      for (const ad of ads) await this.frequency.recordImpression(request.userHash, ad.creativeId, ad.slot);
    }
    return ads;
  }

  /** A click on a served ad; recorded for reporting, never for the person. */
  async click(creativeId: string, userHash?: string): Promise<void> {
    if (userHash) await this.frequency.recordClick(userHash, creativeId);
  }
}
