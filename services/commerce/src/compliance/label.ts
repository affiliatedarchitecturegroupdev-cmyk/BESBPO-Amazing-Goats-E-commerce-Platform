/**
 * R146 (Regulations R146 of 2010, Foodstuffs, Cosmetics and Disinfectants Act 54
 * of 1972) label fields, as pure rules.
 *
 * The mandatory fields a pack must carry are the same for every product; what
 * changes is which fields a given rule set also requires (a meat class under R55
 * of 2015, an egg pack station under R345 of 2020, a dairy approval). Keeping the
 * generator pure lets the API, an admin screen and a future print job agree on
 * one definition, and lets a missing field be a gate rather than a silent blank.
 *
 * Summary of the regulation, not legal advice; confirm wording with an attorney.
 */

export interface LabelCompliance {
  ruleSet: string;
  labelText?: string | null;
  classOrGrade?: string | null;
  packerName?: string | null;
  packStationNo?: string | null;
  certificateExpiry?: string | null;
}

export interface LabelInput {
  productName: string;
  pack: string;
  /** Net weight in grams; `null` when the pack is not sold by weight (e.g. a count). */
  netWeightG?: number | null;
  /** Ingredients in descending order by mass. */
  ingredients?: string[] | null;
  responsibleParty?: { name: string; address: string } | null;
  countryOfOrigin?: string | null;
  batchNo?: string | null;
  /** Date marking (best-before or expiry), ISO date. */
  dateMarking?: string | null;
  storageInstructions?: string | null;
  compliance: LabelCompliance;
}

/** Fields every R146 label must carry, whatever the product. */
export const R146_MANDATORY_FIELDS = [
  'product_name',
  'net_weight',
  'responsible_party',
  'country_of_origin',
  'batch_no',
  'date_marking',
  'storage_instructions',
] as const;

export type LabelField = (typeof R146_MANDATORY_FIELDS)[number] | 'ingredients' | 'class_or_grade' | 'pack_station_no';

/** Rule sets that also require an ingredient list, a class/grade and/or a pack station. */
const RULE_SET_EXTRA_FIELDS: Record<string, LabelField[]> = {
  processed_meat_copacker: ['ingredients'],
  meat_abattoir: ['class_or_grade'],
  poultry_abattoir: ['class_or_grade'],
  egg_pack_station: ['class_or_grade', 'pack_station_no'],
  food_premises: [],
  general: [],
};

/** The fields a label must carry for a given rule set. */
export function requiredLabelFields(ruleSet: string): LabelField[] {
  return [...R146_MANDATORY_FIELDS, ...ruleSetExtraFields(ruleSet)];
}

/** The fields a rule set requires beyond the universal R146 set. */
export function ruleSetExtraFields(ruleSet: string): LabelField[] {
  return RULE_SET_EXTRA_FIELDS[ruleSet] ?? [];
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** True when a date (ISO `YYYY-MM-DD`) is before `asOf`; a missing date never expires. */
export function dateHasPassed(iso: string | null | undefined, asOf: Date): boolean {
  if (!iso) return false;
  const day = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(day)) return false;
  const today = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  return day < today;
}

/** The mandatory label fields this input cannot fill, in a stable order. */
export function missingLabelFields(input: LabelInput): LabelField[] {
  const present: Record<LabelField, boolean> = {
    product_name: isPresent(input.productName),
    net_weight: isPresent(input.netWeightG),
    responsible_party: isPresent(input.responsibleParty?.name) && isPresent(input.responsibleParty?.address),
    country_of_origin: isPresent(input.countryOfOrigin),
    batch_no: isPresent(input.batchNo),
    date_marking: isPresent(input.dateMarking),
    storage_instructions: isPresent(input.storageInstructions),
    ingredients: isPresent(input.ingredients),
    class_or_grade: isPresent(input.compliance.classOrGrade),
    pack_station_no: isPresent(input.compliance.packStationNo),
  };
  return requiredLabelFields(input.compliance.ruleSet).filter((field) => !present[field]);
}

/**
 * The rule-set fields the compliance row itself must carry (a class/grade, a
 * pack station, an ingredient list) that are still blank — the gap an admin has
 * to close on `product_compliance`, not the per-pack fields filled at packing
 * time.
 */
export function missingComplianceFields(compliance: LabelCompliance, ingredients?: string[] | null): LabelField[] {
  const present: Partial<Record<LabelField, boolean>> = {
    class_or_grade: isPresent(compliance.classOrGrade),
    pack_station_no: isPresent(compliance.packStationNo),
    ingredients: isPresent(ingredients),
  };
  return ruleSetExtraFields(compliance.ruleSet).filter((field) => !present[field]);
}

export interface LabelSection {
  heading: string;
  lines: string[];
}

export interface LabelPreview {
  ruleSet: string;
  sections: LabelSection[];
  /** Flat rendering of the label, one line per pack line. */
  lines: string[];
  missing: LabelField[];
  /** A label is valid only when every required field is present. */
  valid: boolean;
}

function formatWeight(netWeightG: number | null | undefined): string | null {
  if (!isPresent(netWeightG)) return null;
  const grams = netWeightG as number;
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${Number.isInteger(kg) ? kg : kg.toFixed(2)} kg`;
  }
  return `${grams} g`;
}

/**
 * Render the R146 label for a pack. The mandatory blocks always appear (an
 * unfilled one reads `[required: …]`), so a preview never hides a gap and the
 * `missing` list drives the gate.
 */
export function buildLabel(input: LabelInput): LabelPreview {
  const missing = missingLabelFields(input);
  const gap = (field: LabelField, label: string) => (missing.includes(field) ? `[required: ${label}]` : null);

  const productLines = [
    input.productName.trim(),
    input.pack.trim(),
    formatWeight(input.netWeightG) ?? gap('net_weight', 'net weight'),
  ].filter((line): line is string => line !== null);

  const identityLines = [
    input.compliance.classOrGrade ? `Class/Grade: ${input.compliance.classOrGrade}` : gap('class_or_grade', 'class or grade'),
    input.compliance.packerName ? `Packed by: ${input.compliance.packerName}` : null,
    input.compliance.packStationNo ? `Pack station: ${input.compliance.packStationNo}` : gap('pack_station_no', 'pack-station number'),
  ].filter((line): line is string => line !== null);

  const ingredientLines = [
    isPresent(input.ingredients) ? `Ingredients: ${(input.ingredients as string[]).join(', ')}` : gap('ingredients', 'ingredient list'),
  ].filter((line): line is string => line !== null);

  const handlingLines = [
    input.countryOfOrigin ? `Country of origin: ${input.countryOfOrigin}` : gap('country_of_origin', 'country of origin'),
    input.batchNo ? `Batch: ${input.batchNo}` : gap('batch_no', 'batch number'),
    input.dateMarking ? `Best before: ${input.dateMarking}` : gap('date_marking', 'date marking'),
    input.storageInstructions ? `Store: ${input.storageInstructions}` : gap('storage_instructions', 'storage instructions'),
  ].filter((line): line is string => line !== null);

  const responsibleLines = input.responsibleParty
    ? [input.responsibleParty.name, input.responsibleParty.address]
    : [(gap('responsible_party', 'responsible party') as string)];

  const sections: LabelSection[] = [
    { heading: 'Product', lines: productLines },
    ...(ingredientLines.length ? [{ heading: 'Ingredients', lines: ingredientLines }] : []),
    ...(identityLines.length ? [{ heading: 'Classification', lines: identityLines }] : []),
    { heading: 'Handling', lines: handlingLines },
    { heading: 'Responsible party', lines: responsibleLines },
  ];

  const lines = sections.flatMap((section) => [`${section.heading}:`, ...section.lines.map((line) => `  ${line}`)]);

  return { ruleSet: input.compliance.ruleSet, sections, lines, missing, valid: missing.length === 0 };
}
