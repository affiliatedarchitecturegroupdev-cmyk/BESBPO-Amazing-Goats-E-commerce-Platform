import { describe, it, expect } from 'vitest';
import { CatalogueItem } from '../catalog/catalog.types';
import { InMemoryCatalogueStore } from '../catalog/catalog.store';
import { ComplianceService, InMemoryComplianceStore } from './compliance.service';

function item(sku: string, name: string, pack: string): CatalogueItem {
  return {
    id: sku,
    sku,
    productId: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    pack,
    unit: 'kg',
    fulfilment: 'pre_order_cycle',
    temperature: 'chilled',
    channel: 'trade_only',
    phase: 1,
    lineCode: 'AG-LB',
    lineName: 'Lamb (flagship)',
    categorySlug: null,
    halaalAvailable: true,
    active: true,
  };
}

function service(items: CatalogueItem[], compliance: Array<{ variantSku: string; ruleSet: string; classOrGrade?: string | null; packerName?: string | null; packStationNo?: string | null; certificateExpiry?: string | null }> = []) {
  return new ComplianceService(
    new InMemoryCatalogueStore(items),
    new InMemoryComplianceStore(compliance as never),
  );
}

const AS_OF = new Date('2026-05-04T00:00:00Z');

describe('ComplianceService', () => {
  it('previews a label from the catalogue and the compliance row', async () => {
    const svc = service(
      [item('AG-LB-001', 'Lamb carcass, whole', '18 to 22 kg')],
      [{ variantSku: 'AG-LB-001', ruleSet: 'meat_abattoir', classOrGrade: 'A2', packerName: 'Vaal Abattoir' }],
    );
    const label = await svc.labelPreview('AG-LB-001', {
      asOf: AS_OF,
      responsibleParty: { name: 'Amazing Goats', address: '1 Market Road' },
      batchNo: 'B-1',
      dateMarking: '2026-05-20',
      storageInstructions: 'Keep chilled',
    });
    expect(label.sku).toBe('AG-LB-001');
    expect(label.ruleSet).toBe('meat_abattoir');
    expect(label.missing).toEqual([]);
    expect(label.certificateExpired).toBe(false);
    expect(label.lines.join('\n')).toContain('Class/Grade: A2');
  });

  it('reports the class/grade an unclassified meat pack is missing', async () => {
    const svc = service([item('AG-LB-001', 'Lamb carcass, whole', '18 to 22 kg')], [
      { variantSku: 'AG-LB-001', ruleSet: 'meat_abattoir' },
    ]);
    const label = await svc.labelPreview('AG-LB-001', { asOf: AS_OF });
    expect(label.missing).toContain('class_or_grade');
    expect(label.valid).toBe(false);
  });

  it('flags a lapsed certificate', async () => {
    const svc = service([item('AG-EG-001', 'Eggs, large', 'Tray of 30')], [
      { variantSku: 'AG-EG-001', ruleSet: 'egg_pack_station', classOrGrade: 'Large', packStationNo: 'PS-42', certificateExpiry: '2026-04-01' },
    ]);
    const label = await svc.labelPreview('AG-EG-001', { asOf: AS_OF });
    expect(label.certificateExpired).toBe(true);
  });

  it('404s an unknown sku', async () => {
    await expect(service([]).labelPreview('AG-XX-999')).rejects.toThrow(/unknown sku/);
  });

  it('updates the compliance fields a rule set needs', async () => {
    const svc = service([item('AG-EG-001', 'Eggs, large', 'Tray of 30')], [
      { variantSku: 'AG-EG-001', ruleSet: 'egg_pack_station' },
    ]);
    const updated = await svc.set('AG-EG-001', { classOrGrade: 'Large', packStationNo: 'PS-42' });
    expect(updated).toMatchObject({ classOrGrade: 'Large', packStationNo: 'PS-42', ruleSet: 'egg_pack_station' });
  });

  it('lists every variant whose compliance row still has a static gap', async () => {
    const svc = service(
      [item('AG-LB-001', 'Lamb carcass, whole', '18 to 22 kg'), item('AG-EG-001', 'Eggs, large', 'Tray of 30')],
      [
        { variantSku: 'AG-LB-001', ruleSet: 'meat_abattoir' },
        { variantSku: 'AG-EG-001', ruleSet: 'egg_pack_station', classOrGrade: 'Large', packStationNo: 'PS-42' },
      ],
    );
    const gaps = await svc.incompleteLabels();
    // The meat pack has no class/grade; the egg tray has both its extra fields.
    expect(gaps).toEqual([{ sku: 'AG-LB-001', ruleSet: 'meat_abattoir', missing: ['class_or_grade'] }]);
  });
});
