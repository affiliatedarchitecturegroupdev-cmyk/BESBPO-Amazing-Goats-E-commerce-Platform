import { describe, it, expect } from 'vitest';
import { BAKERY_PROGRAMME, PACKER_NOTE, inGroup, listedGroups, produceGroups, skuPrefix } from './produce';
import type { StorefrontItem } from './catalog';

const item = (over: Partial<StorefrontItem> = {}): StorefrontItem => ({
  id: 'v1',
  sku: 'AG-EG-001',
  productId: 'p-eggs',
  name: 'Eggs, large',
  pack: 'Tray of 30',
  unit: 'tray',
  fulfilment: 'pre_order_cycle',
  temperature: 'ambient',
  channel: 'both',
  phase: 1,
  line: 'Eggs',
  category: 'eggs',
  halaalAvailable: false,
  farmDirect: true,
  lowStock: false,
  special: false,
  inStock: true,
  priceCents: 8500,
  ...over,
});

describe('skuPrefix', () => {
  it('takes the line part of a SKU', () => {
    expect(skuPrefix('AG-EG-001')).toBe('AG-EG');
    expect(skuPrefix('AG-LM-012')).toBe('AG-LM');
  });

  it('tolerates a short or odd SKU without throwing', () => {
    expect(skuPrefix('AG')).toBe('AG');
    expect(skuPrefix('')).toBe('');
  });
});

describe('inGroup', () => {
  it('matches on the SKU prefix', () => {
    expect(inGroup(item(), { key: 'eggs', label: 'Eggs', prefixes: ['AG-EG'] })).toBe(true);
  });

  it('rejects a line with another prefix', () => {
    expect(inGroup(item({ sku: 'AG-LM-001' }), { key: 'eggs', label: 'Eggs', prefixes: ['AG-EG'] })).toBe(false);
  });

  it('falls back to the line name for a line without a reserved prefix', () => {
    const dairy = item({ sku: 'PARTNER-1', line: 'Dairy' });
    expect(inGroup(dairy, { key: 'milk', label: 'Milk', prefixes: ['AG-DY'], lineNames: ['dairy'] })).toBe(true);
  });
});

describe('produceGroups', () => {
  it('returns all six groups in wireframe order', () => {
    const groups = produceGroups([]);
    expect(groups.map((g) => g.key)).toEqual([
      'eggs', 'milk', 'butter-cheese', 'vegetables', 'herbs', 'soup-packs',
    ]);
  });

  it('marks a group with no catalogue lines as not listed', () => {
    const groups = produceGroups([]);
    expect(groups.every((g) => g.listed === false)).toBe(true);
  });

  it('fills the eggs group from the catalogue', () => {
    const groups = produceGroups([item(), item({ id: 'v2', sku: 'AG-EG-002', name: 'Eggs, medium' })]);
    const eggs = groups.find((g) => g.key === 'eggs')!;
    expect(eggs.listed).toBe(true);
    expect(eggs.items.map((i) => i.name)).toEqual(['Eggs, large', 'Eggs, medium']);
  });

  it('leaves dairy groups unlisted while the catalogue has no dairy SKUs', () => {
    const groups = produceGroups([item()]);
    for (const key of ['milk', 'butter-cheese', 'vegetables', 'herbs', 'soup-packs']) {
      expect(groups.find((g) => g.key === key)!.listed).toBe(false);
    }
  });

  it('orders the items in a group by name so the shelf is stable', () => {
    const groups = produceGroups([
      item({ id: 'a', sku: 'AG-EG-003', name: 'Eggs, extra large' }),
      item({ id: 'b', sku: 'AG-EG-001', name: 'Eggs, medium' }),
    ]);
    expect(groups.find((g) => g.key === 'eggs')!.items.map((i) => i.name)).toEqual([
      'Eggs, extra large', 'Eggs, medium',
    ]);
  });

  it('does not put the same egg line in a dairy group', () => {
    const groups = produceGroups([item()]);
    expect(groups.find((g) => g.key === 'milk')!.items).toEqual([]);
  });
});

describe('listedGroups', () => {
  it('keeps only the groups with lines', () => {
    const groups = produceGroups([item()]);
    expect(listedGroups(groups).map((g) => g.key)).toEqual(['eggs']);
  });
});

describe('the bakery programme', () => {
  it('always points at the trade door', () => {
    expect(BAKERY_PROGRAMME.href).toBe('/trade');
    expect(BAKERY_PROGRAMME.cta).toContain('trade');
  });

  it('names the egg and dairy staples a bakery needs', () => {
    expect(BAKERY_PROGRAMME.body.toLowerCase()).toContain('eggs');
    expect(BAKERY_PROGRAMME.body.toLowerCase()).toContain('butter');
  });
});

describe('PACKER_NOTE', () => {
  it('names the compliance certificate rather than implying approval', () => {
    expect(PACKER_NOTE).toContain('Certificate of Acceptability');
  });
});
