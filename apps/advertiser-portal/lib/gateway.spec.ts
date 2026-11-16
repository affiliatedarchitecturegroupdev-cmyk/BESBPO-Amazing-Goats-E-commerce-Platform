import { describe, it, expect } from 'vitest';
import { toCampaignInput } from './gateway';
import { DEMO_FORM } from './fixtures';

describe('toCampaignInput', () => {
  it('maps the builder form onto the campaign the ads service accepts', () => {
    const input = toCampaignInput(DEMO_FORM, 'org-7');
    expect(input.advertiserOrgId).toBe('org-7');
    expect(input.name).toBe('Charcoal and spice for the braai');
    expect(input.budgetCents).toBe(500_000);
    expect(input.pricing).toBe('flat');
    expect(input.targeting).toEqual({ category: 'lamb', region: 'KwaZulu-Natal', buyerType: 'Household' });
  });

  it('only carries a bid for priced campaigns', () => {
    const flat = toCampaignInput({ ...DEMO_FORM, pricing: 'flat', bidCents: 250 }, 'org-7');
    const cpc = toCampaignInput({ ...DEMO_FORM, pricing: 'cpc', bidCents: 250 }, 'org-7');
    expect(flat.bidCents).toBeUndefined();
    expect(cpc.bidCents).toBe(250);
  });

  it('falls back to the goal when the headline is blank', () => {
    expect(toCampaignInput({ ...DEMO_FORM, headline: '   ' }, 'org-7').name).toBe('Launch the braai season range');
  });
});
