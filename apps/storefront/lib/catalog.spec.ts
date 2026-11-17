import { describe, it, expect } from 'vitest';
import { badgesFor, byCategory, CATEGORIES, featuredBoxes, getBySku, isBoxItem, toStorefrontItems } from './catalog';
import { FIXTURE_CATALOGUE } from './fixtures';

const items = toStorefrontItems(FIXTURE_CATALOGUE);

describe('catalogue view model', () => {
  it('maps a gateway row, falling back to the product line for the category', () => {
    const [first] = items;
    expect(first.sku).toBe('AG-LM-001');
    expect(first.category).toBe('lamb');
    expect(first.line).toBe('Lamb');
    expect(first.priceCents).toBe(189900);
    expect(first.inStock).toBe(false);
  });

  it('gives every item a category that appears in the category list', () => {
    const slugs = new Set(CATEGORIES.map((c) => c.slug));
    for (const item of items) expect(slugs.has(item.category)).toBe(true);
  });

  it('finds items by category and by sku', () => {
    expect(byCategory(items, 'lamb').length).toBeGreaterThan(0);
    expect(byCategory(items, 'lamb').every((i) => i.category === 'lamb')).toBe(true);
    expect(getBySku(items, 'AG-LM-001')?.name).toBe('Full lamb box');
    expect(getBySku(items, 'nope')).toBeUndefined();
  });

  it('offers ready-made bundles for the home page', () => {
    expect(featuredBoxes(items).map((b) => b.sku)).toContain('AG-BX-001');
  });

  it('finds the box line by SKU prefix even when the category slug is missing', () => {
    expect(isBoxItem({ sku: 'AG-BX-001' })).toBe(true);
    expect(isBoxItem({ sku: 'AG-LM-001' })).toBe(false);
    // A catalogue row with no category slug still surfaces the boxes.
    const noSlug = items.map((i) => ({ ...i, category: 'unknown' }));
    expect(featuredBoxes(noSlug).map((b) => b.sku)).toEqual(['AG-BX-001']);
  });

  it('shows the halaal badge for a halaal item and the in-stock flag for stocked goods', () => {
    expect(badgesFor(getBySku(items, 'AG-LM-001')!)).toEqual(['farm_direct', 'halaal']);
    const eggs = getBySku(items, 'AG-EG-001')!;
    expect(badgesFor(eggs)).toEqual(['farm_direct']);
    expect(eggs.inStock).toBe(true);
  });

  it('carries a fulfilment type for every item so the tag always renders', () => {
    for (const item of items) expect(item.fulfilment).toBeTruthy();
  });
});
