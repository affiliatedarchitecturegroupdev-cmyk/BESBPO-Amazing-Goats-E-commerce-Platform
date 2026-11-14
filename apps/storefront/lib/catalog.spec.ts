import { describe, it, expect } from 'vitest';
import { badgesFor, byCategory, CATEGORIES, featuredBoxes, getBySlug, ITEMS } from './catalog';

describe('catalogue view model', () => {
  it('gives every item a category that appears in the category list', () => {
    const slugs = new Set(CATEGORIES.map((c) => c.slug));
    for (const item of ITEMS) expect(slugs.has(item.category)).toBe(true);
  });

  it('finds items by category and by slug', () => {
    expect(byCategory('lamb').length).toBeGreaterThan(0);
    expect(byCategory('lamb').every((i) => i.category === 'lamb')).toBe(true);
    expect(getBySlug('v-full-lamb-box')?.name).toBe('Full lamb box');
    expect(getBySlug('nope')).toBeUndefined();
  });

  it('offers ready-made bundles for the home page', () => {
    expect(featuredBoxes().map((b) => b.sku)).toContain('AG-BX-001');
  });

  it('shows badges in priority order and hides low stock when there is none', () => {
    expect(badgesFor(getBySlug('v-lamb-mince')!)).toEqual(['farm_direct', 'halaal', 'low_stock']);
    expect(badgesFor(getBySlug('v-eggs-tray')!)).toEqual(['farm_direct', 'special']);
  });

  it('carries a fulfilment type for every item so the tag always renders', () => {
    for (const item of ITEMS) expect(item.fulfilment).toBeTruthy();
  });
});
