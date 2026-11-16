import { describe, it, expect } from 'vitest';
import { CampaignsService, CAMPAIGNS_STORE } from './campaigns.service';
import { CREATIVES_STORE, CreativesService } from '../creatives/creatives.service';
import { InMemoryCampaignsStore } from './campaigns.store';
import { InMemoryCreativesStore } from '../creatives/creatives.store';

const at = '2026-11-14T10:00:00.000Z';

const input = {
  advertiserOrgId: 'org-1',
  name: 'Braai season',
  goal: 'Awareness',
  budgetCents: 500_000,
  pricing: 'flat' as const,
};

function services() {
  const campaignsStore = new InMemoryCampaignsStore();
  const creativesStore = new InMemoryCreativesStore();
  const campaigns = new CampaignsService(campaignsStore, creativesStore);
  const creatives = new CreativesService(creativesStore);
  return { campaigns, creatives };
}

describe('CampaignsService', () => {
  it('drafts, submits and approves a campaign with a creative', async () => {
    const { campaigns, creatives } = services();
    const campaign = await campaigns.draft(input);
    expect(campaign.status).toBe('draft');
    await creatives.draft({ campaignId: campaign.id, slotCode: 'A4', assetUrl: 'https://cdn/a.png' });
    expect((await campaigns.submit(campaign.id, at)).status).toBe('pending_review');
    expect((await campaigns.approve(campaign.id, 'reviewer-1', at)).status).toBe('approved');
  });

  it('refuses to submit with no creative', async () => {
    const { campaigns } = services();
    const campaign = await campaigns.draft(input);
    await expect(campaigns.submit(campaign.id, at)).rejects.toThrow(/at least one creative/);
  });

  it('throws NotFound for an unknown campaign', async () => {
    const { campaigns } = services();
    await expect(campaigns.get('nope')).rejects.toThrow(/unknown campaign/);
  });

  it('exposes the store token for wiring', () => {
    expect(typeof CAMPAIGNS_STORE).toBe('symbol');
    expect(typeof CREATIVES_STORE).toBe('symbol');
  });
});
