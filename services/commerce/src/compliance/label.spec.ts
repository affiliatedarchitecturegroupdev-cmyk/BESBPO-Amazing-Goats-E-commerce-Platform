import { describe, it, expect } from 'vitest';
import {
  R146_MANDATORY_FIELDS,
  buildLabel,
  dateHasPassed,
  missingComplianceFields,
  missingLabelFields,
  requiredLabelFields,
} from './label';

const RESPONSIBLE = { name: 'Amazing Goats (Pty) Ltd', address: '1 Market Road, Johannesburg' };

function complete(overrides: Record<string, unknown> = {}) {
  return {
    productName: 'Lamb carcass, whole',
    pack: '18 to 22 kg',
    netWeightG: 18000,
    responsibleParty: RESPONSIBLE,
    countryOfOrigin: 'South Africa',
    batchNo: 'B-2026-0512',
    dateMarking: '2026-05-20',
    storageInstructions: 'Keep chilled at 0 to 4C',
    compliance: { ruleSet: 'meat_abattoir', classOrGrade: 'A2', packerName: 'Vaal Abattoir' },
    ...overrides,
  } as Parameters<typeof buildLabel>[0];
}

describe('requiredLabelFields', () => {
  it('always requires the R146 mandatory fields', () => {
    expect(requiredLabelFields('general').slice(0, R146_MANDATORY_FIELDS.length)).toEqual([...R146_MANDATORY_FIELDS]);
  });

  it('adds an ingredient list for processed meat, and a pack station for eggs', () => {
    expect(requiredLabelFields('processed_meat_copacker')).toContain('ingredients');
    expect(requiredLabelFields('egg_pack_station')).toEqual(
      expect.arrayContaining(['class_or_grade', 'pack_station_no']),
    );
    expect(requiredLabelFields('general')).not.toContain('class_or_grade');
  });
});

describe('dateHasPassed', () => {
  const asOf = new Date('2026-05-04T00:00:00Z');
  it('is false on the day itself and for a future date', () => {
    expect(dateHasPassed('2026-05-04', asOf)).toBe(false);
    expect(dateHasPassed('2026-06-01', asOf)).toBe(false);
  });
  it('is true for a past date, and false when there is no date', () => {
    expect(dateHasPassed('2026-05-03', asOf)).toBe(true);
    expect(dateHasPassed(null, asOf)).toBe(false);
  });
});

describe('missingLabelFields', () => {
  it('reports nothing for a complete meat label', () => {
    expect(missingLabelFields(complete())).toEqual([]);
  });

  it('reports the mandatory field a meat pack is missing', () => {
    expect(missingLabelFields(complete({ batchNo: null }))).toEqual(['batch_no']);
  });

  it('requires the class/grade a meat pack is missing', () => {
    const missing = missingLabelFields(complete({ compliance: { ruleSet: 'meat_abattoir' } }));
    expect(missing).toEqual(['class_or_grade']);
  });

  it('requires the pack station an egg pack is missing', () => {
    const missing = missingLabelFields(
      complete({ compliance: { ruleSet: 'egg_pack_station', classOrGrade: 'Large' } }),
    );
    expect(missing).toEqual(['pack_station_no']);
  });

  it('treats a blank string and an empty ingredient list as absent', () => {
    expect(missingLabelFields(complete({ countryOfOrigin: '   ' }))).toEqual(['country_of_origin']);
    expect(
      missingLabelFields(complete({ compliance: { ruleSet: 'processed_meat_copacker' }, ingredients: [] })),
    ).toEqual(['ingredients']);
  });
});

describe('missingComplianceFields', () => {
  it('reports the rule-set fields the compliance row still needs', () => {
    expect(missingComplianceFields({ ruleSet: 'meat_abattoir' })).toEqual(['class_or_grade']);
    expect(missingComplianceFields({ ruleSet: 'egg_pack_station', classOrGrade: 'Large' })).toEqual(['pack_station_no']);
    expect(missingComplianceFields({ ruleSet: 'processed_meat_copacker' }, [])).toEqual(['ingredients']);
  });

  it('reports nothing when the rule-set fields are filled, or none are needed', () => {
    expect(missingComplianceFields({ ruleSet: 'meat_abattoir', classOrGrade: 'A2' })).toEqual([]);
    expect(missingComplianceFields({ ruleSet: 'general' })).toEqual([]);
  });
});

describe('buildLabel', () => {
  it('renders a valid label with the class, packer and handling lines', () => {
    const label = buildLabel(complete());
    expect(label.valid).toBe(true);
    expect(label.missing).toEqual([]);
    expect(label.lines).toContain('  Class/Grade: A2');
    expect(label.lines).toContain('  Packed by: Vaal Abattoir');
    expect(label.lines).toContain('  18 kg');
    expect(label.lines.join('\n')).toContain('Country of origin: South Africa');
    expect(label.lines.join('\n')).toContain('Best before: 2026-05-20');
  });

  it('marks each missing field inline so a preview never hides a gap', () => {
    const label = buildLabel(complete({ batchNo: null, compliance: { ruleSet: 'meat_abattoir' } }));
    expect(label.valid).toBe(false);
    expect(label.missing).toEqual(['batch_no', 'class_or_grade']);
    const text = label.lines.join('\n');
    expect(text).toContain('[required: batch number]');
    expect(text).toContain('[required: class or grade]');
  });

  it('shows an ingredient section only when the rule set needs it', () => {
    const withIngredients = buildLabel(
      complete({ compliance: { ruleSet: 'processed_meat_copacker' }, ingredients: ['Pork', 'Salt'] }),
    );
    expect(withIngredients.sections.map((s) => s.heading)).toContain('Ingredients');
    expect(withIngredients.lines.join('\n')).toContain('Ingredients: Pork, Salt');

    const without = buildLabel(complete());
    expect(without.sections.map((s) => s.heading)).not.toContain('Ingredients');
  });

  it('formats a sub-kilogram weight in grams', () => {
    const label = buildLabel(complete({ netWeightG: 500 }));
    expect(label.lines.join('\n')).toContain('500 g');
  });

  it('carries the rule set through to the preview', () => {
    expect(buildLabel(complete()).ruleSet).toBe('meat_abattoir');
  });
});
