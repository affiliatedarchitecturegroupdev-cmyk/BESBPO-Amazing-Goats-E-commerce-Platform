import { describe, it, expect } from 'vitest';
import type { CatalogueItem } from '../catalog/catalog.types';
import {
  MerchandisingError,
  assertValidSection,
  isSectionVisible,
  orderItems,
  resolveSection,
  visibleSectionsForPage,
} from './merchandising.rules';
import { MerchItem, MerchSection } from './merchandising.types';

const AT = new Date('2026-06-01T10:00:00.000Z');

function section(over: Partial<MerchSection> = {}): MerchSection {
  return {
    id: 'sec_1',
    code: 'home-hero',
    title: 'This week',
    page: 'home',
    sort: 0,
    active: true,
    startsAt: null,
    endsAt: null,
    ...over,
  };
}

function item(over: Partial<CatalogueItem> & { sku: string }): CatalogueItem {
  return {
    productId: 'p1',
    name: 'Full lamb box',
    pack: '17 kg',
    unit: 'box',
    fulfilment: 'pre_order_cycle',
    temperature: 'chilled',
    channel: 'both',
    phase: 1,
    lineCode: 'AG-LM',
    lineName: 'Lamb',
    categorySlug: 'lamb',
    halaalAvailable: true,
    active: true,
    ...over,
    id: over.sku,
    sku: over.sku,
  };
}

const catalogue = new Map<string, CatalogueItem>([
  ['AG-LM-001', item({ sku: 'AG-LM-001' })],
  ['AG-LM-002', item({ sku: 'AG-LM-002', name: 'Lamb loin chops', pack: '400 g' })],
]);

describe('isSectionVisible', () => {
  it('is visible only when active and inside the half-open window', () => {
    expect(isSectionVisible(section(), AT)).toBe(true);
    expect(isSectionVisible(section({ active: false }), AT)).toBe(false);
    expect(isSectionVisible(section({ startsAt: '2026-07-01T00:00:00.000Z' }), AT)).toBe(false);
    expect(isSectionVisible(section({ endsAt: '2026-06-01T10:00:00.000Z' }), AT)).toBe(false);
  });
});

describe('orderItems', () => {
  it('orders by sort then SKU for a stable tie-break', () => {
    const items: MerchItem[] = [
      { sectionId: 'sec_1', sku: 'B', sort: 1, badge: null },
      { sectionId: 'sec_1', sku: 'A', sort: 1, badge: null },
      { sectionId: 'sec_1', sku: 'C', sort: 0, badge: null },
    ];
    expect(orderItems(items).map((i) => i.sku)).toEqual(['C', 'A', 'B']);
  });
});

describe('resolveSection', () => {
  it('resolves items against the catalogue and keeps display order', () => {
    const items: MerchItem[] = [
      { sectionId: 'sec_1', sku: 'AG-LM-002', sort: 1, badge: 'special' },
      { sectionId: 'sec_1', sku: 'AG-LM-001', sort: 0, badge: null },
    ];
    const resolved = resolveSection(section(), items, catalogue);
    expect(resolved.items.map((i) => i.sku)).toEqual(['AG-LM-001', 'AG-LM-002']);
    expect(resolved.items[1].badge).toBe('special');
    expect(resolved.items[0].name).toBe('Full lamb box');
  });

  it('drops items whose SKU is not in the catalogue', () => {
    const items: MerchItem[] = [
      { sectionId: 'sec_1', sku: 'AG-LM-001', sort: 0, badge: null },
      { sectionId: 'sec_1', sku: 'GONE-999', sort: 1, badge: null },
    ];
    expect(resolveSection(section(), items, catalogue).items.map((i) => i.sku)).toEqual(['AG-LM-001']);
  });
});

describe('visibleSectionsForPage', () => {
  it('returns visible sections for the page in sort order, dropping empty ones', () => {
    const sections = [
      section({ id: 'sec_b', code: 'home-b', page: 'home', sort: 2 }),
      section({ id: 'sec_a', code: 'home-a', page: 'home', sort: 1 }),
      section({ id: 'sec_c', code: 'shop-a', page: 'shop', sort: 0 }),
      section({ id: 'sec_d', code: 'home-empty', page: 'home', sort: 3 }),
    ];
    const items: MerchItem[] = [
      { sectionId: 'sec_a', sku: 'AG-LM-001', sort: 0, badge: null },
      { sectionId: 'sec_b', sku: 'AG-LM-002', sort: 0, badge: null },
    ];
    const resolved = visibleSectionsForPage(sections, items, catalogue, 'home', AT);
    expect(resolved.map((s) => s.code)).toEqual(['home-a', 'home-b']);
  });

  it('hides a section outside its window', () => {
    const sections = [section({ endsAt: '2026-05-01T00:00:00.000Z' })];
    const items: MerchItem[] = [{ sectionId: 'sec_1', sku: 'AG-LM-001', sort: 0, badge: null }];
    expect(visibleSectionsForPage(sections, items, catalogue, 'home', AT)).toEqual([]);
  });
});

describe('assertValidSection', () => {
  it('requires a code and a title', () => {
    expect(() => assertValidSection(section({ code: '' }))).toThrow(MerchandisingError);
    expect(() => assertValidSection(section({ title: '' }))).toThrow(/title/);
  });
  it('rejects a window that ends before it starts', () => {
    expect(() =>
      assertValidSection(section({ startsAt: '2026-06-01T00:00:00.000Z', endsAt: '2026-05-01T00:00:00.000Z' })),
    ).toThrow(/ends before/);
  });
});
