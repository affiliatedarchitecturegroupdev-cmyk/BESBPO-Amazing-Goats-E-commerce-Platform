import { describe, it, expect } from 'vitest';
import { maxSponsoredTiles, placeSponsored, viewBanners, MAX_ADS_PER_VIEW } from './merchandising';

const grid = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}` }));
const ad = (id: string) => ({ item: { id }, slot: 'A4' });

describe('maxSponsoredTiles', () => {
  it('is one tile per five', () => {
    expect(maxSponsoredTiles(4)).toBe(0);
    expect(maxSponsoredTiles(5)).toBe(1);
    expect(maxSponsoredTiles(11)).toBe(2);
    expect(maxSponsoredTiles(12)).toBe(2);
  });
});

describe('placeSponsored', () => {
  it('drops a sponsored tile at position 3 for a grid of five', () => {
    const placed = placeSponsored(grid(5), [ad('spice')]);
    expect(placed[2]).toMatchObject({ sponsored: true, slot: 'A4' });
    expect(placed.filter((p) => p.sponsored)).toHaveLength(1);
  });

  it('places tiles at positions 3 and 7 in a grid of eleven, never exceeding one in five', () => {
    const placed = placeSponsored(grid(11), [ad('a'), ad('b'), ad('c')]);
    const positions = placed.flatMap((p, i) => (p.sponsored ? [i + 1] : []));
    expect(positions).toEqual([3, 7]);
    expect(positions.length).toBeLessThanOrEqual(maxSponsoredTiles(11));
  });

  it('caps sponsored tiles at two per view even when positions allow more', () => {
    const placed = placeSponsored(grid(20), [ad('a'), ad('b'), ad('c')]);
    expect(placed.filter((p) => p.sponsored)).toHaveLength(MAX_ADS_PER_VIEW);
  });

  it('never places a tile when the grid is too short', () => {
    expect(placeSponsored(grid(2), [ad('a')]).every((p) => !p.sponsored)).toBe(true);
  });
});

describe('viewBanners', () => {
  it('shows at most two banners', () => {
    expect(viewBanners(['A1', 'A2', 'A3'])).toEqual(['A1', 'A2']);
  });
});
