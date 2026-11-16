import { describe, it, expect } from 'vitest';
import { SPONSORED, adsForSlot, isRenderableAd, placeAds, renderableAds, ServedAd } from './placements';

const ad = (over: Partial<ServedAd> = {}): ServedAd => ({
  creativeId: 'cr1',
  campaignId: 'c1',
  slot: 'A4',
  sponsored: true,
  label: 'Sponsored',
  headline: 'Charcoal',
  assetUrl: 'https://cdn/a.png',
  ...over,
});

const grid = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}` }));

describe('isRenderableAd', () => {
  it('requires the sponsored flag and the label', () => {
    expect(isRenderableAd(ad())).toBe(true);
    expect(isRenderableAd(ad({ sponsored: false }))).toBe(false);
    expect(isRenderableAd(ad({ label: '' }))).toBe(false);
  });
});

describe('renderableAds', () => {
  it('drops unlabelled ads and caps at two', () => {
    const ads = [ad(), ad({ creativeId: 'cr2' }), ad({ creativeId: 'cr3' }), ad({ sponsored: false, creativeId: 'cr4' })];
    expect(renderableAds(ads).map((a) => a.creativeId)).toEqual(['cr1', 'cr2']);
  });
});

describe('placeAds', () => {
  it('drops an ad at position 3 and never exceeds one in five', () => {
    const placed = placeAds(grid(5), [ad()]);
    expect(placed[2].ad?.creativeId).toBe('cr1');
    expect(placed.filter((p) => p.ad)).toHaveLength(1);
  });

  it('places two ads at positions 3 and 7 in a grid of eleven', () => {
    const placed = placeAds(grid(11), [ad({ creativeId: 'a' }), ad({ creativeId: 'b' })]);
    expect(placed.flatMap((p, i) => (p.ad ? [i + 1] : []))).toEqual([3, 7]);
  });

  it('places no ad in a short grid', () => {
    expect(placeAds(grid(2), [ad()]).every((p) => !p.ad)).toBe(true);
  });

  it('ignores an unlabelled ad entirely', () => {
    expect(placeAds(grid(10), [ad({ label: '' })]).every((p) => !p.ad)).toBe(true);
  });
});

describe('adsForSlot', () => {
  it('returns only the labelled ads for the slot', () => {
    const ads = [ad({ slot: 'A4' }), ad({ slot: 'A1', creativeId: 'cr2' }), ad({ slot: 'A4', label: '', creativeId: 'cr3' })];
    expect(adsForSlot(ads, 'A4').map((a) => a.creativeId)).toEqual(['cr1']);
    expect(adsForSlot(ads, 'A4')[0].label).toBe(SPONSORED);
  });
});
