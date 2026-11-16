import { describe, it, expect } from 'vitest';
import { CreativesService } from './creatives.service';
import { InMemoryCreativesStore } from './creatives.store';

const at = '2026-11-14T10:00:00.000Z';
const base = { campaignId: 'c1', slotCode: 'A4' as const, assetUrl: 'https://cdn/a.png' };

describe('CreativesService', () => {
  it('drafts a creative as pending and lists the review queue', async () => {
    const service = new CreativesService(new InMemoryCreativesStore());
    const creative = await service.draft(base);
    expect(creative.reviewStatus).toBe('pending');
    expect((await service.pending()).map((c) => c.id)).toEqual([creative.id]);
  });

  it('approves a creative and clears it from the queue', async () => {
    const service = new CreativesService(new InMemoryCreativesStore());
    const creative = await service.draft(base);
    const approved = await service.review(creative.id, 'reviewer-1', 'approved', undefined, at);
    expect(approved.reviewStatus).toBe('approved');
    expect(await service.pending()).toEqual([]);
  });

  it('refuses to draft a claim without evidence', async () => {
    const service = new CreativesService(new InMemoryCreativesStore());
    await expect(service.draft({ ...base, headline: 'Halaal lamb' })).rejects.toThrow(/evidence is required/);
  });

  it('refuses to approve a claim-bearing creative that reached the store', async () => {
    // A creative can only get here by some other path, so the review guard is
    // tested against a seeded store rather than the draft route.
    const store = new InMemoryCreativesStore([
      { id: 'cr1', campaignId: 'c1', slotCode: 'A4', assetUrl: 'https://cdn/a.png', headline: 'Organic lamb', reviewStatus: 'pending' },
    ]);
    const service = new CreativesService(store);
    await expect(service.review('cr1', 'reviewer-1', 'approved')).rejects.toThrow(/needs evidence/);
  });

  it('filters by campaign and throws NotFound for an unknown creative', async () => {
    const service = new CreativesService(new InMemoryCreativesStore());
    await service.draft(base);
    await service.draft({ ...base, campaignId: 'c2' });
    expect((await service.list('c2')).length).toBe(1);
    await expect(service.get('nope')).rejects.toThrow(/unknown creative/);
  });
});
