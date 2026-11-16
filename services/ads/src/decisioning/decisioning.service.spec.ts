import { describe, it, expect } from 'vitest';
import { DecisioningService } from './decisioning.service';
import { InMemoryFrequencyStore } from './frequency.store';
import { InMemoryCampaignsStore } from '../campaigns/campaigns.store';
import { InMemoryCreativesStore } from '../creatives/creatives.store';
import {
  approveCampaign,
  draftCampaign,
  draftCreative,
  goLive,
  reviewCreative,
  submitForReview,
} from '../campaigns/campaign-rules';

const at = '2026-11-14T10:00:00.000Z';

async function live() {
  const campaigns = new InMemoryCampaignsStore();
  const creatives = new InMemoryCreativesStore();
  const frequency = new InMemoryFrequencyStore();
  const campaign = await campaigns.insert(
    draftCampaign('c1', {
      advertiserOrgId: 'org-1',
      name: 'Braai season',
      goal: 'Awareness',
      budgetCents: 500_000,
      pricing: 'cpc',
      bidCents: 120,
      targeting: { category: 'lamb' },
    }),
  );
  const creative = await creatives.insert(
    draftCreative('c1-cr', { campaignId: 'c1', slotCode: 'A4', assetUrl: 'https://cdn/a.png', headline: 'Braai lamb' }),
  );
  const reviewed = await creatives.replace(reviewCreative(creative, 'reviewer-1', 'approved', at));
  await campaigns.replace(
    goLive(approveCampaign(submitForReview(campaign, 1, at), 'reviewer-1', at), [reviewed], at),
  );
  return new DecisioningService(campaigns, creatives, frequency);
}

describe('DecisioningService', () => {
  it('serves a labelled ad from a live campaign', async () => {
    const service = await live();
    const ads = await service.serve({ slot: 'A4', category: 'lamb' });
    expect(ads).toHaveLength(1);
    expect(ads[0]).toMatchObject({ creativeId: 'c1-cr', label: 'Sponsored', sponsored: true });
  });

  it('caps a creative at the frequency limit for one user', async () => {
    const service = await live();
    const first = await service.serve({ slot: 'A4', userHash: 'u1' });
    expect(first).toHaveLength(1);
    // The default cap is 3; the first serve recorded one impression.
    expect(await service.serve({ slot: 'A4', userHash: 'u1' })).toHaveLength(1);
    expect(await service.serve({ slot: 'A4', userHash: 'u1' })).toHaveLength(1);
    expect(await service.serve({ slot: 'A4', userHash: 'u1' })).toEqual([]);
    // Another user is unaffected.
    expect(await service.serve({ slot: 'A4', userHash: 'u2' })).toHaveLength(1);
  });

  it('serves nothing in an empty slot', async () => {
    const service = await live();
    expect(await service.serve({ slot: 'A9' })).toEqual([]);
  });

  it('records a click without failing', async () => {
    const service = await live();
    await expect(service.click('c1-cr', 'u1')).resolves.toBeUndefined();
  });
});
