import { AdCandidate, selectAds } from './select-ads';
import { Campaign, Creative, canGoLive } from '../campaigns/campaign-rules';

/** Every served ad carries this label (docs/06-ads.md: label every ad Sponsored). */
export const SPONSORED_LABEL = 'Sponsored';

/** How many times one creative may show to one user before it is capped. */
export const DEFAULT_FREQUENCY_CAP = 3;

export interface AdPlacement {
  creativeId: string;
  campaignId: string;
  slot: string;
  /** Always true: decisioning never returns an unlabelled ad. */
  sponsored: true;
  /** Always `SPONSORED_LABEL`; the storefront renders this verbatim. */
  label: string;
  headline?: string;
  assetUrl: string;
  destinationUrl?: string;
}

export interface ServeInput {
  campaigns: Campaign[];
  creatives: Creative[];
  slot: string;
  category?: string;
  maxAds?: number;
  /** Impressions already shown to this user, by creative id. */
  impressions: Record<string, number>;
  frequencyCap?: number;
}

/**
 * The candidates that may be served in a slot: a campaign that may run (the
 * same `canGoLive` gate the review queue uses), with an approved creative in
 * that slot. Bid and budget come from the campaign; category comes from its
 * targeting, so a category match wins the tie-break in `selectAds`.
 */
export function eligibleCandidates(input: ServeInput): AdCandidate[] {
  const byCampaign = new Map<string, Creative[]>();
  for (const creative of input.creatives) {
    const list = byCampaign.get(creative.campaignId) ?? [];
    list.push(creative);
    byCampaign.set(creative.campaignId, list);
  }

  const frequencyCap = input.frequencyCap ?? DEFAULT_FREQUENCY_CAP;
  const candidates: AdCandidate[] = [];
  for (const campaign of input.campaigns) {
    const creatives = byCampaign.get(campaign.id) ?? [];
    if (!canGoLive(campaign, creatives).ok) continue;
    for (const creative of creatives) {
      if (creative.reviewStatus !== 'approved' || creative.slotCode !== input.slot) continue;
      candidates.push({
        id: creative.id,
        slot: input.slot,
        categories: campaign.targeting.category ? [campaign.targeting.category] : [],
        bidCents: campaign.bidCents ?? 0,
        remainingBudgetCents: Math.max(0, campaign.budgetCents - campaign.spentCents),
        approved: true,
        frequencyCap,
        impressionsForUser: input.impressions[creative.id] ?? 0,
      });
    }
  }
  return candidates;
}

/**
 * Serve the ads for a slot: pick with `selectAds`, then wrap every pick in the
 * Sponsored label and the creative's content. The result is always labelled, so
 * a caller cannot render an ad without it.
 */
export function serveAds(input: ServeInput): AdPlacement[] {
  const picked = selectAds(eligibleCandidates(input), {
    slot: input.slot,
    category: input.category,
    maxAds: input.maxAds ?? 2,
  });
  const byCreative = new Map(input.creatives.map((c) => [c.id, c]));
  return picked.map((candidate) => {
    const creative = byCreative.get(candidate.id)!;
    return {
      creativeId: creative.id,
      campaignId: creative.campaignId,
      slot: creative.slotCode,
      sponsored: true,
      label: SPONSORED_LABEL,
      headline: creative.headline,
      assetUrl: creative.assetUrl,
      destinationUrl: creative.destinationUrl,
    };
  });
}
