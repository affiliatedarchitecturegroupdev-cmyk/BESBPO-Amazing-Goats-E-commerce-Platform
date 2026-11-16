import type { Temperature } from '@ag/shared-types';
import type { CartLine } from './cart';

/** Cart groups, in the order the cart shows them. */
export const GROUP_ORDER: Temperature[] = ['chilled', 'frozen', 'ambient', 'live'];

const HEADING: Record<Temperature, string> = {
  chilled: 'Chilled',
  frozen: 'Frozen',
  ambient: 'Ambient: courier',
  live: 'Live animals',
};

const NOTE: Partial<Record<Temperature, string>> = {
  live: 'Reservations are paid as a deposit at checkout.',
};

export interface CartGroup {
  temperature: Temperature;
  heading: string;
  note?: string;
  lines: CartLine[];
  subtotalExVatCents: number;
}

/**
 * Group cart lines by how they travel, in a fixed order, so the customer sees
 * chilled, frozen, ambient and live goods separately.
 */
export function groupByFulfilment(lines: CartLine[]): CartGroup[] {
  return GROUP_ORDER.flatMap((temperature) => {
    const groupLines = lines.filter((l) => l.temperature === temperature);
    if (groupLines.length === 0) return [];
    return [{
      temperature,
      heading: HEADING[temperature],
      note: NOTE[temperature],
      lines: groupLines,
      subtotalExVatCents: groupLines.reduce((sum, l) => sum + l.unitPriceExVatCents * l.qty, 0),
    }];
  });
}

/** Free on route days within zone 1; otherwise the zone fee applies. */
export function deliveryLine(zoneId: number | string | undefined, feeCents: number): { label: string; feeCents: number } {
  const label = zoneId === 1 || zoneId === '1' ? 'Delivery (zone 1, free on route days)' : `Delivery (zone ${zoneId ?? '—'})`;
  return { label, feeCents };
}
