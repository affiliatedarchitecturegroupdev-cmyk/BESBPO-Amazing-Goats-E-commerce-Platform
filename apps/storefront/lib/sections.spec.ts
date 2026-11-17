import { describe, it, expect } from 'vitest';
import type { ResolvedSection } from '@ag/api-client';
import { CATALOGUE_SECTION_CODE, sectionHero, toMerchSection, toMerchSections } from './sections';

const tile = (sku: string, badge: string | null = null) => ({
  sku,
  name: `Item ${sku}`,
  pack: '1 kg',
  badge,
  item: {
    id: sku,
    sku,
    productId: `p-${sku}`,
    name: `Item ${sku}`,
    pack: '1 kg',
    unit: 'each',
    fulfilment: 'in_stock' as const,
    temperature: 'chilled' as const,
    channel: 'both' as const,
    phase: 1 as const,
    lineCode: 'AG-BX',
    lineName: 'Boxes',
    categorySlug: 'boxes',
    halaalAvailable: false,
    active: true,
    priceCents: 74900,
  },
});

const resolved: ResolvedSection = {
  code: 'home-hero',
  title: 'This week',
  page: 'home',
  items: [tile('AG-BX-001', 'special'), tile('AG-BX-002')],
};

describe('toMerchSection', () => {
  it('maps a resolved section into render-ready cards on the storefront view model', () => {
    const section = toMerchSection(resolved);
    expect(section.code).toBe('home-hero');
    expect(section.title).toBe('This week');
    expect(section.cards).toHaveLength(2);
    // The tile becomes a storefront item, so the shared card can render it.
    expect(section.cards[0].item.category).toBe('boxes');
    expect(section.cards[0].item.priceCents).toBe(74900);
    expect(section.cards[0].badge).toBe('special');
    expect(section.cards[1].badge).toBeNull();
  });

  it('maps every section in a list, preserving order', () => {
    const other: ResolvedSection = { code: CATALOGUE_SECTION_CODE, title: 'Shop the range', page: 'home', items: [tile('AG-BX-003')] };
    const sections = toMerchSections([resolved, other]);
    expect(sections.map((s) => s.code)).toEqual(['home-hero', CATALOGUE_SECTION_CODE]);
  });

  it('is an empty list when there are no sections', () => {
    expect(toMerchSections([])).toEqual([]);
  });
});

describe('sectionHero', () => {
  it('is the first card, or undefined when the section is empty', () => {
    expect(sectionHero(toMerchSection(resolved))?.sku).toBe('AG-BX-001');
    expect(sectionHero({ code: 'x', title: 'X', cards: [] })).toBeUndefined();
  });
});
