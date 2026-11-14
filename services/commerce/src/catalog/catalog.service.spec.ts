import { describe, it, expect } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { CatalogService, findCatalogueCsv } from './catalog.service';
import { InMemoryCatalogueStore, itemsFromMapping } from './catalog.store';
import { CatalogueItem } from './catalog.types';
import { applyFilters, didYouMean, levenshtein, rankItems, similarity } from './catalog.search';
import { mapCatalogue, parseCatalogueCsv } from './catalogue-mapping';

function item(partial: Partial<CatalogueItem> & { sku: string }): CatalogueItem {
  return {
    id: partial.sku,
    productId: partial.sku,
    name: partial.sku,
    pack: '',
    unit: 'each',
    fulfilment: 'in_stock',
    temperature: 'ambient',
    channel: 'both',
    phase: 1,
    lineCode: 'AG-TS',
    lineName: 'Test line',
    categorySlug: null,
    halaalAvailable: false,
    active: true,
    ...partial,
  };
}

const SAMPLE: CatalogueItem[] = [
  item({ sku: 'AG-LG-001', name: 'Boer kid, female', lineCode: 'AG-LG', lineName: 'Live goats', channel: 'both', temperature: 'live', fulfilment: 'reservation', phase: 1 }),
  item({ sku: 'AG-LB-001', name: 'Lamb box, half', lineCode: 'AG-LB', lineName: 'Lamb (flagship)', channel: 'trade_only', temperature: 'chilled', fulfilment: 'pre_order_cycle', phase: 1, categorySlug: 'lamb-boxes' }),
  item({ sku: 'AG-EG-001', name: 'Eggs, large', lineCode: 'AG-EG', lineName: 'Eggs', channel: 'public_only', temperature: 'ambient', fulfilment: 'pre_order_cycle', phase: 1, categorySlug: 'eggs' }),
  item({ sku: 'AG-PK-001', name: 'Pork loin', lineCode: 'AG-PK', lineName: 'Pork', channel: 'both', temperature: 'chilled', fulfilment: 'in_stock', phase: 2 }),
];

describe('applyFilters', () => {
  it('filters by line code or name, case-insensitive', () => {
    expect(applyFilters(SAMPLE, { line: 'AG-LG' }).map((i) => i.sku)).toEqual(['AG-LG-001']);
    expect(applyFilters(SAMPLE, { line: 'live goats' }).map((i) => i.sku)).toEqual(['AG-LG-001']);
  });
  it('filters by category, fulfilment, channel, phase and temperature', () => {
    expect(applyFilters(SAMPLE, { category: 'eggs' }).map((i) => i.sku)).toEqual(['AG-EG-001']);
    expect(applyFilters(SAMPLE, { fulfilment: 'pre_order_cycle' }).map((i) => i.sku).sort()).toEqual(['AG-EG-001', 'AG-LB-001']);
    expect(applyFilters(SAMPLE, { channel: 'public_only' }).map((i) => i.sku)).toEqual(['AG-EG-001']);
    expect(applyFilters(SAMPLE, { phase: 2 }).map((i) => i.sku)).toEqual(['AG-PK-001']);
    expect(applyFilters(SAMPLE, { temperature: 'chilled' }).map((i) => i.sku)).toEqual(['AG-LB-001', 'AG-PK-001']);
  });
  it('combines filters with AND', () => {
    expect(applyFilters(SAMPLE, { channel: 'both', temperature: 'chilled' }).map((i) => i.sku)).toEqual(['AG-PK-001']);
  });
});

describe('similarity and levenshtein', () => {
  it('measures edit distance', () => {
    expect(levenshtein('chops', 'chpos')).toBe(2);
    expect(levenshtein('lamb', 'lamb')).toBe(0);
    expect(levenshtein('', 'abc')).toBe(3);
  });
  it('scores identical and prefix terms highest', () => {
    expect(similarity('lamb', 'lamb')).toBe(1);
    expect(similarity('chicken', 'chickens')).toBeGreaterThan(0.9);
    expect(similarity('lamb', 'lambchops')).toBeGreaterThan(similarity('lamb', 'pork'));
    expect(similarity('lamb', 'pork')).toBeLessThan(0.4);
  });
});

describe('rankItems', () => {
  it('ranks an exact term first and tolerates a transposition', () => {
    expect(rankItems('lamb', SAMPLE).map((i) => i.sku)[0]).toBe('AG-LB-001');
    expect(rankItems('egs', SAMPLE).map((i) => i.sku)).toContain('AG-EG-001');
  });
  it('drops unrelated items', () => {
    expect(rankItems('zzzz', SAMPLE)).toEqual([]);
  });
});

describe('didYouMean', () => {
  const vocab = ['lamb', 'chops', 'boer', 'kid', 'eggs', 'large'];
  it('offers a correction for a typo', () => {
    expect(didYouMean('lamb chpos', vocab)).toBe('lamb chops');
  });
  it('stays quiet when the query is already good', () => {
    expect(didYouMean('lamb chops', vocab)).toBeNull();
  });
});

describe('CatalogService over the T-003 seed', () => {
  const csv = findCatalogueCsv();
  if (!csv) throw new Error('seed CSV not found');
  const seeded = new InMemoryCatalogueStore(itemsFromMapping(mapCatalogue(parseCatalogueCsv(readFileSync(csv, 'utf8')))));
  const service = new CatalogService(seeded);

  it('lists the whole catalogue, sorted by SKU', async () => {
    const all = await service.list();
    expect(all).toHaveLength(140);
    expect(all.map((i) => i.sku)).toEqual([...all.map((i) => i.sku)].sort());
  });

  it('filters by line and channel', async () => {
    const liveGoats = await service.list({ line: 'AG-LG' });
    expect(liveGoats.length).toBeGreaterThan(0);
    expect(liveGoats.every((i) => i.lineCode === 'AG-LG')).toBe(true);
    const tradeOnly = await service.list({ channel: 'trade_only' });
    expect(tradeOnly.length).toBeGreaterThan(0);
    expect(tradeOnly.every((i) => i.channel === 'trade_only')).toBe(true);
  });

  it('searches with typo tolerance and suggests a correction', async () => {
    const res = await service.search('biltng');
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.some((i) => i.name.toLowerCase().includes('biltong'))).toBe(true);
    expect(res.didYouMean).toBe('biltong');
  });

  it('applies filters to search', async () => {
    const res = await service.search('beef', { channel: 'trade_only' });
    expect(res.items.every((i) => i.channel === 'trade_only')).toBe(true);
  });

  it('reads one item and 404s on an unknown SKU', async () => {
    expect((await service.get('AG-LG-001')).sku).toBe('AG-LG-001');
    await expect(service.get('NOPE-999')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates, updates and removes items', async () => {
    const store = new InMemoryCatalogueStore([item({ sku: 'AG-TS-001', name: 'Test sausage' })]);
    const svc = new CatalogService(store);
    await svc.upsert(item({ sku: 'AG-TS-001', name: 'Test sausage, smoked' }));
    expect((await svc.get('AG-TS-001')).name).toBe('Test sausage, smoked');
    await svc.remove('AG-TS-001');
    await expect(svc.get('AG-TS-001')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.remove('AG-TS-001')).rejects.toBeInstanceOf(NotFoundException);
  });
});
