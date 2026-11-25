import { describe, it, expect } from 'vitest';
import {
  CUT_GUIDE,
  MEAL_PROFILES,
  adultEquivalent,
  estimateMeat,
  mealProfile,
  roundUpToHalfKg,
  suggestForMeal,
} from './recipes';
import type { StorefrontItem } from './catalog';

const item = (over: Partial<StorefrontItem> = {}): StorefrontItem => ({
  id: 'v1',
  sku: 'AG-LM-001',
  productId: 'p-lamb',
  name: 'Lamb loin chops',
  pack: '400 g',
  unit: 'pack',
  fulfilment: 'pre_order_cycle',
  temperature: 'chilled',
  channel: 'both',
  phase: 1,
  line: 'Lamb (flagship)',
  category: 'lamb',
  halaalAvailable: true,
  farmDirect: true,
  lowStock: false,
  special: false,
  inStock: true,
  priceCents: 12900,
  ...over,
});

describe('adultEquivalent', () => {
  it('counts adults one for one', () => {
    expect(adultEquivalent({ adults: 8, children: 0 })).toBe(8);
  });

  it('counts a child as 0.6 of an adult', () => {
    expect(adultEquivalent({ adults: 4, children: 5 })).toBe(7);
  });

  it('treats a negative count as none rather than reducing the table', () => {
    expect(adultEquivalent({ adults: -3, children: 2 })).toBe(1.2);
  });

  it('is zero for an empty table', () => {
    expect(adultEquivalent({ adults: 0, children: 0 })).toBe(0);
  });
});

describe('roundUpToHalfKg', () => {
  it('rounds up to the next half kilogram', () => {
    expect(roundUpToHalfKg(5100)).toBe(5.5);
    expect(roundUpToHalfKg(5000)).toBe(5);
    expect(roundUpToHalfKg(5001)).toBe(5.5);
  });

  it('rounds a small weight up rather than down to nothing', () => {
    expect(roundUpToHalfKg(100)).toBe(0.5);
  });

  it('is zero for zero or a negative weight', () => {
    expect(roundUpToHalfKg(0)).toBe(0);
    expect(roundUpToHalfKg(-200)).toBe(0);
  });
});

describe('estimateMeat', () => {
  it('gives 12 braai guests about 7 kg, the wireframe worked example', () => {
    const estimate = estimateMeat({ adults: 12, children: 0 }, 'braai');
    expect(estimate.rawKg).toBe(6.6);
    expect(estimate.kg).toBe(7);
  });

  it('rounds up when the raw weight falls between half kilos', () => {
    // 10 guests at 550 g = 5.5 kg exactly; one more guest pushes to 6.5 kg.
    expect(estimateMeat({ adults: 10, children: 0 }, 'braai').kg).toBe(5.5);
    expect(estimateMeat({ adults: 11, children: 0 }, 'braai').kg).toBe(6.5);
  });

  it('counts children in the estimate', () => {
    const estimate = estimateMeat({ adults: 6, children: 5 }, 'braai');
    // 6 + 5*0.6 = 9 adult equivalents * 550 g = 4.95 kg, rounded up to 5 kg
    expect(estimate.adultEquivalents).toBe(9);
    expect(estimate.kg).toBe(5);
  });

  it('uses the meal profile weight, so a potjie needs less meat than a braai', () => {
    const braai = estimateMeat({ adults: 10, children: 0 }, 'braai');
    const potjie = estimateMeat({ adults: 10, children: 0 }, 'potjie');
    expect(braai.kg).toBeGreaterThan(potjie.kg);
    expect(potjie.kg).toBe(3.5); // 3.5 kg exactly
  });

  it('asks for nothing when there are no guests', () => {
    const estimate = estimateMeat({ adults: 0, children: 0 }, 'braai');
    expect(estimate.kg).toBe(0);
    expect(estimate.rawKg).toBe(0);
  });

  it('carries the meal guidance line through', () => {
    expect(estimateMeat({ adults: 4, children: 0 }, 'roast').note).toContain('boneless');
  });

  it('falls back to the braai for an unknown meal rather than failing', () => {
    expect(estimateMeat({ adults: 4, children: 0 }, 'no-such-meal').meal.key).toBe('braai');
  });
});

describe('mealProfile', () => {
  it('finds a profile by key', () => {
    expect(mealProfile('potjie').label).toBe('Potjie');
  });

  it('defaults to the first profile', () => {
    expect(mealProfile('nope')).toBe(MEAL_PROFILES[0]);
  });
});

describe('suggestForMeal', () => {
  it('suggests priced lamb lines, cheapest first', () => {
    const items = [
      item({ sku: 'a', priceCents: 50000 }),
      item({ sku: 'b', priceCents: 10000 }),
      item({ sku: 'c', priceCents: 30000 }),
    ];
    expect(suggestForMeal(items, 'braai').map((i) => i.sku)).toEqual(['b', 'c', 'a']);
  });

  it('includes boerewors for a braai but not for a roast', () => {
    const items = [
      item({ sku: 'lamb', category: 'lamb', line: 'Lamb (flagship)', priceCents: 10000 }),
      item({ sku: 'wors', category: 'boerewors', line: 'Boerewors and sausages', priceCents: 20000 }),
    ];
    expect(suggestForMeal(items, 'braai').map((i) => i.sku)).toEqual(['lamb', 'wors']);
    expect(suggestForMeal(items, 'roast').map((i) => i.sku)).toEqual(['lamb']);
  });

  it('never suggests a quote-only line with no price', () => {
    const items = [item({ sku: 'quote', priceCents: null as unknown as number })];
    expect(suggestForMeal(items, 'braai')).toEqual([]);
  });

  it('respects the limit', () => {
    const items = Array.from({ length: 6 }, (_, i) => item({ sku: `s${i}`, priceCents: 1000 * (i + 1) }));
    expect(suggestForMeal(items, 'braai', 2)).toHaveLength(2);
  });
});

describe('CUT_GUIDE', () => {
  it('tells the reader how to cook and how to store every cut', () => {
    for (const entry of CUT_GUIDE) {
      expect(entry.cook.length).toBeGreaterThan(0);
      expect(entry.store.length).toBeGreaterThan(0);
    }
  });

  it('covers the cuts the catalogue carries', () => {
    const cuts = CUT_GUIDE.map((c) => c.cut.toLowerCase()).join(' ');
    for (const expected of ['loin chops', 'neck', 'shoulder', 'leg', 'shanks', 'ribs']) {
      expect(cuts).toContain(expected);
    }
  });
});
