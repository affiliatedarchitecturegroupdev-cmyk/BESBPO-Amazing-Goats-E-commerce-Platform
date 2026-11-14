import { getBySlug } from './catalog';
import type { Cart, CartLine } from './cart';

const line = (slug: string, qty: number): CartLine => {
  const item = getBySlug(slug);
  if (!item) throw new Error(`unknown seed item ${slug}`);
  return {
    sku: item.sku,
    name: item.name,
    qty,
    unitPriceExVatCents: item.priceCents ?? 0,
    fulfilment: item.fulfilment,
    temperature: item.temperature,
  };
};

/** Demo cart used until the cart service is wired to the gateway. */
export function seedCart(): Cart {
  return {
    lines: [
      line('v-full-lamb-box', 1),
      line('v-lamb-loin-chops', 2),
      { sku: 'AG-PR-003', name: 'Spice rub 200 g', qty: 1, unitPriceExVatCents: 4500, fulfilment: 'in_stock', temperature: 'ambient' },
      line('v-boer-wether', 1),
    ],
    deliveryFeeCents: 6500,
    zoneId: 2,
  };
}
