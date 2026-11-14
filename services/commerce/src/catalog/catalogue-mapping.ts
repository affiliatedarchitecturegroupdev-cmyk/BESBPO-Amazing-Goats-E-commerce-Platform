import { Channel, FulfilmentType, Phase, Temperature } from '@ag/shared-types';

/** One row of db/seeds/catalogue_v1.csv. */
export interface CatalogueRow {
  SKU: string;
  'Product line': string;
  Group: string;
  Product: string;
  'Variant or pack': string;
  Unit: string;
  'Fulfilment type': string;
  Source: string;
  Temperature: string;
  Channel: string;
  Phase: string;
  'Key rules and compliance': string;
}

export interface ProductLineRecord {
  code: string;
  name: string;
  group: string;
  phase: Phase;
}

export interface ProductRecord {
  slug: string;
  lineCode: string;
  name: string;
  halaalAvailable: boolean;
}

export interface VariantRecord {
  sku: string;
  productSlug: string;
  pack: string;
  unit: string;
  fulfilment: FulfilmentType;
  temperature: Temperature;
  channel: Channel;
  phase: Phase;
  sourceKind: string;
  weightG: number | null;
}

export interface ComplianceRecord {
  variantSku: string;
  ruleSet: string;
  labelText: string;
  classOrGrade: string | null;
  packerName: string | null;
  packStationNo: string | null;
}

export type MappingIssueCode =
  | 'fulfilment_defaulted'
  | 'temperature_defaulted'
  | 'fulfilment_unknown'
  | 'temperature_unknown'
  | 'channel_unknown';

export interface MappingIssue {
  sku: string;
  field: 'Fulfilment type' | 'Temperature' | 'Channel';
  code: MappingIssueCode;
  message: string;
}

export interface CatalogueMapping {
  lines: ProductLineRecord[];
  products: ProductRecord[];
  variants: VariantRecord[];
  compliance: ComplianceRecord[];
  issues: MappingIssue[];
}

const FULFILMENT: Record<string, FulfilmentType> = {
  'In stock': 'in_stock',
  'Pre-order cycle': 'pre_order_cycle',
  Reservation: 'reservation',
  Quote: 'quote',
  'Seasonal pre-order': 'seasonal_pre_order',
};

const TEMPERATURE: Record<string, Temperature> = {
  Live: 'live',
  'Chilled (0 to 4C)': 'chilled',
  'Frozen (-18C)': 'frozen',
  Ambient: 'ambient',
};

const CHANNEL: Record<string, Channel> = {
  Both: 'both',
  'Public only': 'public_only',
  'Trade only': 'trade_only',
};

/**
 * The catalogue leaves two frozen chicken rows without a fulfilment type. They
 * are shelf/freezer stock (not cut to a weekly cycle), so they load as
 * `in_stock`; the assumption is reported as an issue rather than hidden.
 */
const DEFAULT_FULFILMENT: FulfilmentType = 'in_stock';
/** `Ambient or chilled` has no enum value; shelf-stable goods load as `ambient`. */
const DEFAULT_TEMPERATURE: Temperature = 'ambient';

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** SKU minus its trailing sequence, e.g. AG-LG-007 -> AG-LG. */
export function skuPrefix(sku: string): string {
  return sku.replace(/-\d+$/, '');
}

/**
 * Extract the lower-bound weight in grams from a pack description.
 * `1.2 to 1.6 kg` -> 1200, `500 g` -> 500, `About 17 kg` -> 17000,
 * `4 pack` / `Adjustable` -> null. Volumes (ml) are not weights.
 */
export function parseWeightG(pack: string): number | null {
  const m = /(\d+(?:\.\d+)?)(?:\s*(?:to|-)\s*\d+(?:\.\d+)?)?\s*(kg|g)\b/i.exec(pack);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return null;
  return Math.round(m[2].toLowerCase() === 'kg' ? value * 1000 : value);
}

/** Primary compliance rule set for a row, chosen by the most specific match. */
export function complianceRuleSet(rules: string): string {
  const t = rules.toLowerCase();
  if (/egg|packing station|pack station/.test(t)) return 'egg_pack_station';
  if (/poultry abattoir|registered poultry/.test(t)) return 'poultry_abattoir';
  if (/abattoir|meat safety|classified|r55/.test(t)) return 'meat_abattoir';
  if (/co-?pack|processed-meat|nrcs/.test(t)) return 'processed_meat_copacker';
  if (/movement permit|health papers|\bbrand\b|foot-and-mouth|animal diseases/.test(t)) return 'animal_health_movement';
  if (/certificate of acceptability|r638|food safe|food-contact/.test(t)) return 'food_premises';
  return 'general';
}

function phaseOf(raw: string): Phase {
  const n = Number.parseInt(raw, 10);
  if (n === 1 || n === 2 || n === 3) return n;
  throw new Error(`invalid phase: ${raw}`);
}

/** Minimal RFC 4180 CSV parser: quoted fields, embedded commas and "" escapes. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ''));
}

/** Parse the catalogue CSV into typed rows. */
export function parseCatalogueCsv(text: string): CatalogueRow[] {
  const table = parseCsv(text);
  if (table.length === 0) return [];
  const header = table[0].map((h) => h.trim());
  return table
    .slice(1)
    .filter((r) => r.length === header.length && r.some((c) => c.trim() !== ''))
    .map((r) => {
      const obj: Record<string, string> = {};
      header.forEach((h, i) => (obj[h] = r[i]));
      return obj as unknown as CatalogueRow;
    });
}

/** Map catalogue rows into product lines, products, variants and compliance. */
export function mapCatalogue(rows: CatalogueRow[]): CatalogueMapping {
  const lines = new Map<string, ProductLineRecord>();
  const products = new Map<string, ProductRecord>();
  const variants: VariantRecord[] = [];
  const compliance: ComplianceRecord[] = [];
  const issues: MappingIssue[] = [];

  for (const row of rows) {
    const sku = row.SKU.trim();
    const lineCode = skuPrefix(sku);
    const phase = phaseOf(row.Phase);
    const productSlug = `${lineCode.toLowerCase()}-${slugify(row.Product)}`;

    if (!lines.has(lineCode)) {
      lines.set(lineCode, { code: lineCode, name: row['Product line'], group: row.Group, phase });
    }

    const rules = row['Key rules and compliance'];
    if (!products.has(productSlug)) {
      products.set(productSlug, {
        slug: productSlug,
        lineCode,
        name: row.Product,
        halaalAvailable: /halaal/i.test(rules),
      });
    }

    const fulfilmentRaw = row['Fulfilment type'].trim();
    let fulfilment = FULFILMENT[fulfilmentRaw];
    if (!fulfilment) {
      fulfilment = DEFAULT_FULFILMENT;
      issues.push({
        sku,
        field: 'Fulfilment type',
        code: fulfilmentRaw === '' ? 'fulfilment_defaulted' : 'fulfilment_unknown',
        message: `fulfilment "${fulfilmentRaw}" mapped to "${fulfilment}"`,
      });
    }

    const temperatureRaw = row.Temperature.trim();
    let temperature = TEMPERATURE[temperatureRaw];
    if (!temperature) {
      temperature = DEFAULT_TEMPERATURE;
      issues.push({
        sku,
        field: 'Temperature',
        code: temperatureRaw === '' ? 'temperature_defaulted' : 'temperature_unknown',
        message: `temperature "${temperatureRaw}" mapped to "${temperature}"`,
      });
    }

    const channelRaw = row.Channel.trim();
    const channel = CHANNEL[channelRaw];
    if (!channel) {
      issues.push({ sku, field: 'Channel', code: 'channel_unknown', message: `channel "${channelRaw}" is not known` });
      continue; // channel is NOT NULL; skip rather than guess
    }

    variants.push({
      sku,
      productSlug,
      pack: row['Variant or pack'],
      unit: row.Unit,
      fulfilment,
      temperature,
      channel,
      phase,
      sourceKind: row.Source,
      weightG: parseWeightG(row['Variant or pack']),
    });

    compliance.push({
      variantSku: sku,
      ruleSet: complianceRuleSet(rules),
      labelText: rules,
      classOrGrade: null,
      packerName: null,
      packStationNo: null,
    });
  }

  return {
    lines: [...lines.values()],
    products: [...products.values()],
    variants,
    compliance,
    issues,
  };
}
