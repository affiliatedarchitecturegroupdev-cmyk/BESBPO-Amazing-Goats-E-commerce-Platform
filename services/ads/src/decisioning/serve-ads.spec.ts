import { describe, it, expect } from 'vitest';
import { SPONSORED_LABEL, eligibleCandidates, serveAds } from './serve-ads';
import { Campaign, Creative, approveCampaign, draftCampaign, draftCreative, goLive, reviewCreative, submitForReview } from '../campaigns/campaign-rules';

const at = '2026-11-14T10:00:00.000Z';

const campaignInput = {
  advertiserOrgId: 'org-1',
  name: 'Braai season',
  goal: 'Awareness',
  budgetCents: 500_000,
  pricing: 'cpc' as const,
  bidCents: 120,
  targeting: { category: 'lamb' },
};

function liveCampaign(id: string, over: Partial<typeof campaignInput> = {}): { campaign: Campaign; creative: Creative } {
  const base = draftCampaign(id, { ...campaignInput, ...over });
  const creative = draftCreative(`${id}-cr`, { campaignId: id, slotCode: 'A4', assetUrl: 'https://cdn/a.png', headline: 'Braai lamb' });
  const reviewed = reviewCreative(creative, 'reviewer-1', 'approved', at);
  const approved = approveCampaign(submitForReview(base, 1, at), 'reviewer-1', at);
  const live = goLive(approved, [reviewed], at);
  return { campaign: live, creative: reviewed };
}

describe('eligibleCandidates', () => {
  it('includes a live campaign with an approved creative in the slot', () => {
    const { campaign, creative } = liveCampaign('c1');
    const candidates = eligibleCandidates({ campaigns: [campaign], creatives: [creative], slot: 'A4', impressions: {} });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ id: 'c1-cr', slot: 'A4', categories: ['lamb'], bidCents: 120 });
  });

  it('excludes a campaign whose creative is still pending', () => {
    const campaign = approveCampaign(submitForReview(draftCampaign('c1', campaignInput), 1, at), 'reviewer-1', at);
    const pending = draftCreative('c1-cr', { campaignId: 'c1', slotCode: 'A4', assetUrl: 'https://cdn/a.png' });
    expect(eligibleCandidates({ campaigns: [campaign], creatives: [pending], slot: 'A4', impressions: {} })).toEqual([]);
  });

  it('excludes a draft campaign and a creative in another slot', () => {
    const draft = draftCampaign('c1', campaignInput);
    const creative = draftCreative('c1-cr', { campaignId: 'c1', slotCode: 'A1', assetUrl: 'https://cdn/a.png' });
    expect(eligibleCandidates({ campaigns: [draft], creatives: [creative], slot: 'A4', impressions: {} })).toEqual([]);
  });
});

describe('serveAds', () => {
  it('labels every served ad Sponsored', () => {
    const { campaign, creative } = liveCampaign('c1');
    const ads = serveAds({ campaigns: [campaign], creatives: [creative], slot: 'A4', impressions: {} });
    expect(ads).toHaveLength(1);
    expect(ads[0].sponsored).toBe(true);
    expect(ads[0].label).toBe(SPONSORED_LABEL);
  });

  it('serves at most two ads', () => {
    const a = liveCampaign('c1');
    const b = liveCampaign('c2');
    const c = liveCampaign('c3');
    const ads = serveAds({
      campaigns: [a.campaign, b.campaign, c.campaign],
      creatives: [a.creative, b.creative, c.creative],
      slot: 'A4',
      impressions: {},
    });
    expect(ads).toHaveLength(2);
  });

  it('prefers the category match', () => {
    const match = liveCampaign('c1', { bidCents: 100, targeting: { category: 'lamb' } });
    const other = liveCampaign('c2', { bidCents: 100, targeting: { category: 'eggs' } });
    const ads = serveAds({
      campaigns: [match.campaign, other.campaign],
      creatives: [match.creative, other.creative],
      slot: 'A4',
      category: 'lamb',
      maxAds: 1,
      impressions: {},
    });
    expect(ads[0].creativeId).toBe('c1-cr');
  });

  it('honours the frequency cap', () => {
    const { campaign, creative } = liveCampaign('c1');
    const ads = serveAds({
      campaigns: [campaign],
      creatives: [creative],
      slot: 'A4',
      impressions: { 'c1-cr': 3 },
      frequencyCap: 3,
    });
    expect(ads).toEqual([]);
  });

  it('serves nothing when the budget is exhausted', () => {
    const { campaign, creative } = liveCampaign('c1');
    const spent = { ...campaign, spentCents: campaign.budgetCents };
    expect(serveAds({ campaigns: [spent], creatives: [creative], slot: 'A4', impressions: {} })).toEqual([]);
  });
});
