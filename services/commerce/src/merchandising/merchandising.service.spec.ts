import { describe, it, expect } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { CatalogueItem } from '../catalog/catalog.types';
import { InMemoryCatalogueStore } from '../catalog/catalog.store';
import { MerchandisingService } from './merchandising.service';
import { InMemoryMerchandisingStore } from './merchandising.store';
import { MerchItem, MerchSection } from './merchandising.types';

const AT = new Date('2026-06-01T10:00:00.000Z');

const section: MerchSection = {
  id: 'sec_1',
  code: 'home-hero',
  title: 'This week',
  page: 'home',
  sort: 0,
  active: true,
  startsAt: null,
  endsAt: null,
};

const item: MerchItem = { sectionId: 'sec_1', sku: 'AG-LM-001', sort: 0, badge: 'special' };

const catalogueItem: CatalogueItem = {
  id: 'AG-LM-001',
  sku: 'AG-LM-001',
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
};

const service = (sections: MerchSection[] = [], items: MerchItem[] = []) =>
  new MerchandisingService(
    new InMemoryMerchandisingStore(sections, items),
    new InMemoryCatalogueStore([catalogueItem]),
  );

describe('MerchandisingService', () => {
  it('upserts a section and reads it back', async () => {
    const svc = service();
    await svc.upsert(section);
    expect((await svc.get('sec_1')).code).toBe('home-hero');
    expect(await svc.list()).toHaveLength(1);
  });

  it('replaces a section\'s items', async () => {
    const svc = service([section]);
    const saved = await svc.setItems('sec_1', [{ sectionId: 'ignored', sku: 'AG-LM-001', sort: 0, badge: null }]);
    expect(saved).toEqual([{ sectionId: 'sec_1', sku: 'AG-LM-001', sort: 0, badge: null }]);
  });

  it('resolves a page against the catalogue', async () => {
    const svc = service([section], [item]);
    const resolved = await svc.forPage('home', AT);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].items[0]).toMatchObject({ sku: 'AG-LM-001', badge: 'special', name: 'Full lamb box' });
  });

  it('resolves one section regardless of visibility', async () => {
    const svc = service([{ ...section, active: false }], [item]);
    expect((await svc.resolve('sec_1')).items).toHaveLength(1);
    expect(await svc.forPage('home', AT)).toEqual([]);
  });

  it('404s on an unknown section', async () => {
    await expect(service().get('nope')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service().setItems('nope', [])).rejects.toBeInstanceOf(NotFoundException);
  });
});
