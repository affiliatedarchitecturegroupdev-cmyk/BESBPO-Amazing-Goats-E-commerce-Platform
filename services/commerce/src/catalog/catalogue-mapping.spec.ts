import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  complianceRuleSet,
  mapCatalogue,
  parseCatalogueCsv,
  parseCsv,
  parseWeightG,
  skuPrefix,
  slugify,
} from './catalogue-mapping';

/** Walk up from the current directory to the repo root that holds the seed CSV. */
function findCatalogueCsv(start = process.cwd()): string {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, 'db/seeds/catalogue_v1.csv');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('db/seeds/catalogue_v1.csv not found');
}

const rows = parseCatalogueCsv(readFileSync(findCatalogueCsv(), 'utf8'));

describe('parseCsv', () => {
  it('handles quoted fields, embedded commas and escaped quotes', () => {
    const t = parseCsv('a,b\n"x, y","he said ""hi"""\n');
    expect(t).toEqual([
      ['a', 'b'],
      ['x, y', 'he said "hi"'],
    ]);
  });
  it('strips a UTF-8 BOM and ignores blank lines', () => {
    const t = parseCsv('\uFEFFh1,h2\nv1,v2\n\n');
    expect(t[0]).toEqual(['h1', 'h2']);
    expect(t.filter((r) => r.length)).toHaveLength(2);
  });
});

describe('field helpers', () => {
  it('slugifies product names', () => {
    expect(slugify('Boer kid, female')).toBe('boer-kid-female');
    expect(slugify('Whole chicken, fresh')).toBe('whole-chicken-fresh');
    expect(slugify('Biltong and droëwors')).toBe('biltong-and-dro-wors');
  });
  it('derives the SKU prefix', () => {
    expect(skuPrefix('AG-LG-007')).toBe('AG-LG');
    expect(skuPrefix('AG-CH-002')).toBe('AG-CH');
  });
  it('parses pack weights to grams, taking the lower bound of a range', () => {
    expect(parseWeightG('1.2 to 1.6 kg')).toBe(1200);
    expect(parseWeightG('500 g')).toBe(500);
    expect(parseWeightG('About 17 kg')).toBe(17000);
    expect(parseWeightG('1 kg')).toBe(1000);
    expect(parseWeightG('4 pack')).toBeNull();
    expect(parseWeightG('Adjustable')).toBeNull();
    expect(parseWeightG('500 ml')).toBeNull();
  });
  it('picks the most specific compliance rule set', () => {
    expect(complianceRuleSet('Graded at a registered egg packing station; date marking')).toBe('egg_pack_station');
    expect(complianceRuleSet('Slaughter at registered poultry abattoir only')).toBe('poultry_abattoir');
    expect(complianceRuleSet('Slaughter at approved abattoir; carcass classified; R146 label')).toBe('meat_abattoir');
    expect(complianceRuleSet('Made by registered co-packer to our recipe; NRCS processed-meat rules')).toBe(
      'processed_meat_copacker',
    );
    expect(complianceRuleSet('Movement permit, brand and health papers')).toBe('animal_health_movement');
    expect(complianceRuleSet('Food-contact materials must be food safe; standard VAT')).toBe('food_premises');
    expect(complianceRuleSet('Cut and packed at approved premises with Certificate of Acceptability; delivered chilled in insulated branded box')).toBe('food_premises');
  });
});

describe('catalogue_v1.csv mapping (T-003 acceptance)', () => {
  const mapping = mapCatalogue(rows);

  it('loads exactly 140 variants, one per SKU', () => {
    expect(rows).toHaveLength(140);
    expect(mapping.variants).toHaveLength(140);
    expect(new Set(mapping.variants.map((v) => v.sku)).size).toBe(140);
  });

  it('creates the 16 product lines with group and phase', () => {
    expect(mapping.lines).toHaveLength(16);
    expect(mapping.lines.map((l) => l.code).sort()).toEqual([
      'AG-BD', 'AG-BF', 'AG-BW', 'AG-BX', 'AG-CH', 'AG-CS', 'AG-CT', 'AG-EG',
      'AG-IC', 'AG-LB', 'AG-LG', 'AG-MP', 'AG-OF', 'AG-PK', 'AG-RA', 'AG-SP',
    ]);
    const liveGoats = mapping.lines.find((l) => l.code === 'AG-LG')!;
    expect(liveGoats).toMatchObject({ name: 'Live goats', group: 'Live animals', phase: 1 });
  });

  it('creates products for every distinct product name, with unique slugs', () => {
    expect(mapping.products).toHaveLength(133);
    expect(new Set(mapping.products.map((p) => p.slug)).size).toBe(133);
    // every variant points at a product that exists
    const slugs = new Set(mapping.products.map((p) => p.slug));
    expect(mapping.variants.every((v) => slugs.has(v.productSlug))).toBe(true);
  });

  it('groups multi-variant products correctly', () => {
    const eggsLarge = mapping.products.find((p) => p.name === 'Eggs, large')!;
    const variants = mapping.variants.filter((v) => v.productSlug === eggsLarge.slug);
    expect(variants.map((v) => v.pack).sort()).toEqual(['Box of 12', 'Box of 6', 'Tray of 30']);
  });

  it('creates one compliance row per product variant, with a rule set', () => {
    expect(mapping.compliance).toHaveLength(140);
    const bySku = new Map(mapping.compliance.map((c) => [c.variantSku, c]));
    expect(bySku.get('AG-LB-001')?.ruleSet).toBe('meat_abattoir');
    expect(bySku.get('AG-EG-001')?.ruleSet).toBe('egg_pack_station');
    expect(bySku.get('AG-LG-001')?.ruleSet).toBe('animal_health_movement');
    expect(bySku.get('AG-BW-001')?.ruleSet).toBe('processed_meat_copacker');
    expect(mapping.compliance.every((c) => c.labelText.length > 0)).toBe(true);
  });

  it('maps every enum value into the database enums', () => {
    expect(new Set(mapping.variants.map((v) => v.fulfilment))).toEqual(
      new Set(['in_stock', 'pre_order_cycle', 'reservation', 'quote', 'seasonal_pre_order']),
    );
    expect(new Set(mapping.variants.map((v) => v.temperature))).toEqual(
      new Set(['live', 'chilled', 'frozen', 'ambient']),
    );
    expect(new Set(mapping.variants.map((v) => v.channel))).toEqual(
      new Set(['both', 'public_only', 'trade_only']),
    );
  });

  it('flags the two blank fulfilment rows instead of hiding them', () => {
    const defaulted = mapping.issues.filter((i) => i.code === 'fulfilment_defaulted');
    expect(defaulted.map((i) => i.sku).sort()).toEqual(['AG-CH-002', 'AG-CH-008']);
    expect(mapping.variants.find((v) => v.sku === 'AG-CH-002')?.fulfilment).toBe('in_stock');
  });

  it('defaults "Ambient or chilled" to ambient and flags it', () => {
    const t = mapping.issues.filter((i) => i.field === 'Temperature');
    expect(t.length).toBeGreaterThan(0);
    expect(t.every((i) => i.code === 'temperature_unknown')).toBe(true);
    expect(mapping.variants.find((v) => v.sku === 'AG-EG-001')?.temperature).toBe('ambient');
  });

  it('derives halaal availability and weights where stated', () => {
    expect(mapping.products.find((p) => p.slug.includes('whole-chicken-fresh'))?.halaalAvailable).toBe(true);
    expect(mapping.products.find((p) => p.slug.includes('boer-kid-female'))?.halaalAvailable).toBe(false);
    expect(mapping.variants.find((v) => v.sku === 'AG-LB-001')?.weightG).toBe(18000);
    expect(mapping.variants.find((v) => v.sku === 'AG-LG-001')?.weightG).toBeNull();
  });
});
