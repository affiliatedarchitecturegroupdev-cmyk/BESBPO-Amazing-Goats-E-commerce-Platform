import type { StorefrontItem } from './catalog';

/**
 * The dairy and produce shelf (T-055, wireframe `sf-produce`).
 *
 * The wireframe asks for six groups: eggs, milk and maas, butter and cheese,
 * vegetables, herbs and soup packs. The catalogue today carries eggs and no
 * dairy or produce SKUs at all, so this module's job is to say that honestly:
 * a group with nothing in it is reported as `listed: false` and the page says
 * so, rather than showing a placeholder card that looks like a product.
 *
 * Grouping is by SKU prefix and line, never by guessing from a product name,
 * because the prefix is what the catalogue import and the commerce mapper both
 * key on (`db/seeds/002_catalogue_import.sql`).
 */

/** One shelf group as the page renders it. */
export interface ProduceGroup {
  key: string;
  label: string;
  /** The SKU prefixes that belong to this group. */
  prefixes: string[];
  /** True when the catalogue has at least one sellable line here. */
  listed: boolean;
  items: StorefrontItem[];
}

interface GroupSpec {
  key: string;
  label: string;
  prefixes: string[];
  /** Line or group names that also belong here, for lines without a prefix yet. */
  lineNames?: string[];
}

/**
 * The six groups, in wireframe order. Dairy and produce prefixes are reserved
 * here ahead of the SKUs existing, so the day the supplier onboarding lands the
 * lines appear without a code change.
 */
const GROUP_SPECS: GroupSpec[] = [
  { key: 'eggs', label: 'Eggs', prefixes: ['AG-EG'], lineNames: ['eggs'] },
  { key: 'milk', label: 'Milk and maas', prefixes: ['AG-DY'], lineNames: ['dairy'] },
  { key: 'butter-cheese', label: 'Butter and cheese', prefixes: ['AG-DY'], lineNames: ['dairy'] },
  { key: 'vegetables', label: 'Vegetables', prefixes: ['AG-VG'], lineNames: ['produce', 'vegetables'] },
  { key: 'herbs', label: 'Herbs', prefixes: ['AG-HB'], lineNames: ['herbs'] },
  { key: 'soup-packs', label: 'Soup packs', prefixes: ['AG-SP'], lineNames: ['soup packs'] },
];

/** The SKU prefix (`AG-EG-001` → `AG-EG`), matching the catalogue import. */
export function skuPrefix(sku: string): string {
  return sku.split('-').slice(0, 2).join('-');
}

/**
 * Whether an item belongs to a group. The prefix is authoritative; the line name
 * is a fallback for a line whose SKU prefix is not yet reserved.
 */
export function inGroup(item: StorefrontItem, spec: GroupSpec): boolean {
  if (spec.prefixes.includes(skuPrefix(item.sku))) return true;
  const line = (item.line ?? '').toLowerCase();
  return (spec.lineNames ?? []).some((name) => line === name);
}

/**
 * The six groups with the catalogue's items in them. Items are ordered by name
 * so the shelf is stable between requests, and a group with no items is still
 * returned, marked `listed: false`, because its absence is information.
 */
export function produceGroups(items: StorefrontItem[]): ProduceGroup[] {
  return GROUP_SPECS.map((spec) => {
    const matched = items
      .filter((item) => inGroup(item, spec))
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      key: spec.key,
      label: spec.label,
      prefixes: spec.prefixes,
      listed: matched.length > 0,
      items: matched,
    };
  });
}

/** The groups that actually have stock lines, for the "on the shelf now" count. */
export function listedGroups(groups: ProduceGroup[]): ProduceGroup[] {
  return groups.filter((g) => g.listed);
}

/**
 * The bakery programme entry (wireframe: "For bakeries — eggs, butter, cream,
 * early delivery, weekly standing orders"). It is a trade door, not a product,
 * so it always renders and always points at the trade portal.
 */
export const BAKERY_PROGRAMME = {
  heading: 'For bakeries',
  body: 'Eggs, butter, cream and early delivery, on weekly standing orders with a locked cut-off.',
  cta: 'Apply for a trade account',
  /** The trade portal path; the storefront's `/trade` page forwards there. */
  href: '/trade',
} as const;

/**
 * The compliance line the wireframe requires: eggs and produce come from
 * compliant packers only. Stated on the page so the claim is visible, not
 * implied (docs/07-compliance.md).
 */
export const PACKER_NOTE =
  'Eggs and produce come from compliant packers only, with a Certificate of Acceptability on file.';
