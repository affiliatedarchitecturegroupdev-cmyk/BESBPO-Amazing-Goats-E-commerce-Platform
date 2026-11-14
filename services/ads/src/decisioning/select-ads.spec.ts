import { describe, it, expect } from 'vitest';
import { selectAds, maxSponsoredTiles, AdCandidate } from './select-ads';

const ad = (id: string, over: Partial<AdCandidate> = {}): AdCandidate => ({ id, slot: 'A4', categories: ['lamb'], bidCents: 100, remainingBudgetCents: 10000, approved: true, frequencyCap: 3, impressionsForUser: 0, ...over });

describe('ad selection', () => {
  it('skips unapproved, out-of-budget and capped ads', () => {
    const r = selectAds([ad('a', { approved: false }), ad('b', { remainingBudgetCents: 10 }), ad('c', { impressionsForUser: 3 }), ad('d')], { slot: 'A4', maxAds: 2 });
    expect(r.map((x) => x.id)).toEqual(['d']);
  });
  it('never returns more than two ads', () => {
    expect(selectAds([ad('a'), ad('b'), ad('c')], { slot: 'A4', maxAds: 5 }).length).toBe(2);
  });
  it('prefers category matches', () => {
    expect(selectAds([ad('a', { categories: ['eggs'] }), ad('b')], { slot: 'A4', category: 'lamb', maxAds: 1 })[0].id).toBe('b');
  });
  it('limits sponsored tiles to one in five', () => { expect(maxSponsoredTiles(12)).toBe(2); });
});
