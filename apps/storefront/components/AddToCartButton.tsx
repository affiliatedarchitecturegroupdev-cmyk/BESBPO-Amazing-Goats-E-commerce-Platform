import { addToCart } from '../lib/cart-actions';
import type { PricedItem } from '../lib/cart';

/**
 * Add to the cart through a server action. The form carries only the SKU, the
 * quantity and where to return to; the price is resolved on the server from the
 * catalogue, so the browser never sends a price.
 */
export function AddToCartButton({
  item,
  redirectTo,
  qty = 1,
  label = 'Add to cart',
}: {
  item: PricedItem;
  redirectTo: string;
  qty?: number;
  label?: string;
}) {
  return (
    <form action={addToCart}>
      <input type="hidden" name="sku" value={item.sku} />
      <input type="hidden" name="qty" value={String(qty)} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <button className="btn" type="submit">{label}</button>
    </form>
  );
}
