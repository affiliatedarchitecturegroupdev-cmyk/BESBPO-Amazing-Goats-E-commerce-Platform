import { describe, it, expect } from 'vitest';
import { toStorefrontItems } from './catalog';
import { FIXTURE_CATALOGUE } from './fixtures';
import { BUDGET_BANDS, OCCASIONS, bundlesFor, getOccasion, withinBudget } from './occasions';

const items = toStorefrontItems(FIXTURE_CATALOGUE);

describe('occasions', () => {
  it('has a unique slug for every occasion and a lookup by slug', () => {
    const slugs = OCCASIONS.map((o) => o.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(getOccasion('braai-day')?.label).toBe('Braai day');
    expect(getOccasion('nope')).toBeUndefined();
  });

  it('lists cooking methods and recipes for each occasion, matching the wireframe', () => {
    const braai = getOccasion('braai-day')!;
    expect(braai.cookingMethods).toContain('Braai');
    expect(braai.cookingMethods).toContain('Potjie');
    expect(braai.recipeTitles.length).toBeGreaterThan(0);
  });
});

describe('bundlesFor', () => {
  it('returns only the box line, by SKU prefix', () => {
    const bundles = bundlesFor(items);
    expect(bundles.map((b) => b.sku)).toContain('AG-BX-001');
    expect(bundles.every((b) => b.sku.startsWith('AG-BX'))).toBe(true);
  });
});

describe('withinBudget', () => {
  it('keeps priced items at or below the band and drops the unpriced', () => {
    const under500 = withinBudget(items, 50_000);
    expect(under500.every((i) => i.priceCents != null && i.priceCents <= 50_000)).toBe(true);
    expect(under500.map((i) => i.sku)).not.toContain('AG-LG-005'); // R3,200
  });

  it('orders the bands from cheapest to dearest', () => {
    const caps = BUDGET_BANDS.map((b) => b.maxCents);
    expect([...caps].sort((a, b) => a - b)).toEqual(caps);
  });
});
